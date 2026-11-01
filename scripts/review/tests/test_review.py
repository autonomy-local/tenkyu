"""段階の判定とレビューの関門を、GitHub なしで確かめる。

  python3 -m unittest discover -s scripts/review/tests
"""
import pathlib
import sys
import unittest
import urllib.error
from unittest import mock

HERE = pathlib.Path(__file__).resolve()
sys.path.insert(0, str(HERE.parents[1]))
ROOT = HERE.parents[3]

import gate  # noqa: E402
import risk  # noqa: E402
from gate import LineComment, Review  # noqa: E402
from risk import FileChange as F  # noqa: E402

CONF = risk.load(ROOT / ".github/settings/risk.yml")
OWNERS = risk.parse_codeowners("* @alice\ndocs/ @bob\n")
ME, AI = "alice", "coderabbitai[bot]"


def tier(*files, body=""):
    return risk.classify(CONF, [f if isinstance(f, F) else F(f) for f in files], body).tier


class Classify(unittest.TestCase):
    def test_docs_only_is_light(self):
        self.assertEqual(tier("docs/guide.md", "README.md"), "light")

    def test_agents_md_is_critical(self):
        self.assertEqual(tier("AGENTS.md"), "critical")

    def test_adr_is_critical(self):
        self.assertEqual(tier("docs/decisions/0001-x.md"), "critical")

    def test_plain_code_is_standard(self):
        self.assertEqual(tier("src/app.ts"), "standard")

    def test_migration_is_critical(self):
        self.assertEqual(tier("src/app.ts", "db/migrations/001.sql"), "critical")

    def test_lockfile_raises_light_to_standard(self):
        self.assertEqual(tier("docs/a.md", "package-lock.json"), "standard")

    def test_removed_test_raises(self):
        self.assertEqual(tier(F("src/a.test.ts", status="removed", deletions=10)), "standard")
        self.assertEqual(tier("src/app.ts", F("src/a.test.ts", deletions=10, additions=1)), "critical")

    def test_large_change_raises(self):
        self.assertEqual(tier(F("src/app.ts", additions=900)), "critical")

    def test_adr_impact_in_body(self):
        body = "## ADR への影響\n\n0014 を改訂する\n\n## 出典"
        self.assertEqual(tier("src/app.ts", body=body), "critical")
        self.assertEqual(tier("src/app.ts", body="## ADR への影響\n\n<!-- x -->\nなし\n"), "standard")

    def test_workflow_permissions_signal(self):
        f = F(".github/workflows/x.yml", patch="+permissions:\n+  contents: write")
        r = risk.classify(CONF, [f])
        self.assertEqual(r.tier, "critical")

    def test_rename_from_critical_stays_critical(self):
        f = F("docs/login.md", status="renamed", previous_filename="src/auth/login.ts")
        self.assertEqual(tier(f), "critical")

    def test_rename_from_lockfile_raises(self):
        f = F("docs/lock.md", status="renamed", previous_filename="package-lock.json")
        self.assertEqual(tier(f), "standard")

    def test_rename_from_test_with_fewer_lines_raises(self):
        f = F("docs/a.md", status="renamed", previous_filename="src/a.test.ts", deletions=5)
        self.assertEqual(tier(f), "standard")

    def test_rename_out_of_tests_raises(self):
        f = F("docs/a.md", status="renamed", previous_filename="src/a.test.ts")
        self.assertEqual(tier(f), "standard")

    def test_pr_template_is_critical(self):
        self.assertEqual(tier(".github/PULL_REQUEST_TEMPLATE.md"), "critical")

    def test_codeowners_last_match_wins(self):
        self.assertEqual(risk.owners_of(OWNERS, "docs/a.md"), ["bob"])
        self.assertEqual(risk.owners_of(OWNERS, "src/a.ts"), ["alice"])


def run(files, reviews=(), comments=(), commits=("c1",), commit_files=None, conf=CONF, escalated=False):
    res = risk.classify(conf, [F(f) for f in files])
    cf = commit_files or {commits[-1]: list(files)}
    return gate.evaluate(conf, res, head=commits[-1], commits=list(commits), commit_files=cf,
                         reviews=list(reviews), comments=list(comments), codeowners=OWNERS, toured={},
                         escalated=escalated)


class Gate(unittest.TestCase):
    def test_light_passes(self):
        self.assertTrue(run(["docs/a.md"])[0])

    def test_standard_needs_ai(self):
        self.assertFalse(run(["src/a.ts"])[0])
        self.assertTrue(run(["src/a.ts"], [Review(AI, True, "APPROVED", "", "c1")])[0])

    def test_standard_ai_on_old_commit_is_not_enough(self):
        self.assertFalse(run(["src/a.ts"], [Review(AI, True, "APPROVED", "", "c1")], commits=("c1", "c2"),
                             commit_files={"c1": ["src/a.ts"], "c2": ["src/a.ts"]})[0])

    def test_standard_summary_substitutes(self):
        self.assertTrue(run(["src/a.ts"], [Review(ME, False, "COMMENTED", "読んだ", "c1")])[0])

    def test_critical_needs_all(self):
        files = ["db/migrations/1.sql", "src/auth/login.ts"]
        ai = Review(AI, True, "APPROVED", "", "c1")
        summ = Review(ME, False, "COMMENTED", "読んだ所：…", "c1")
        one = LineComment(ME, False, "db/migrations/1.sql", "c1")
        two = LineComment(ME, False, "src/auth/login.ts", "c1")
        self.assertFalse(run(files, [ai, summ], [one])[0])
        self.assertTrue(run(files, [ai, summ], [one, two])[0])

    def test_critical_bot_comments_do_not_count(self):
        files = ["db/x.sql"]
        r = [Review(AI, True, "APPROVED", "", "c1"), Review("jules[bot]", True, "COMMENTED", "ok", "c1")]
        self.assertFalse(run(files, r, [LineComment("jules[bot]", True, "db/x.sql", "c1")])[0])

    def test_critical_non_owner_does_not_count(self):
        files = ["db/x.sql"]
        r = [Review(AI, True, "APPROVED", "", "c1"), Review("eve", False, "COMMENTED", "ok", "c1")]
        self.assertFalse(run(files, r, [LineComment("eve", False, "db/x.sql", "c1")])[0])

    def test_later_critical_push_invalidates(self):
        files = ["db/x.sql"]
        cf = {"c1": ["db/x.sql"], "c2": ["db/x.sql"]}
        r = [Review(AI, True, "APPROVED", "", "c2"), Review(ME, False, "COMMENTED", "ok", "c1")]
        self.assertFalse(run(files, r, [LineComment(ME, False, "db/x.sql", "c1")], commits=("c1", "c2"), commit_files=cf)[0])

    def test_later_noncritical_push_keeps_human_review(self):
        files = ["db/x.sql", "src/a.ts"]
        cf = {"c1": ["db/x.sql"], "c2": ["src/a.ts"]}
        r = [Review(AI, True, "APPROVED", "", "c2"), Review(ME, False, "COMMENTED", "ok", "c1")]
        self.assertTrue(run(files, r, [LineComment(ME, False, "db/x.sql", "c1")], commits=("c1", "c2"), commit_files=cf)[0])

    def test_reused_login_does_not_count(self):
        files = ["db/x.sql"]
        r = [Review(AI, True, "APPROVED", "", "c1"), Review(ME, False, "COMMENTED", "読んだ", "c1", trusted=False)]
        self.assertFalse(run(files, r, [LineComment(ME, False, "db/x.sql", "c1", trusted=False)])[0])

    def test_team_owner_does_not_count_outsiders(self):
        owners = risk.parse_codeowners("* @org/team\n")
        res = risk.classify(CONF, [F("src/a.ts")])
        conf = {**CONF, "settings": {**CONF["settings"], "ai_reviewer": "none"}}

        def ok(trusted):
            review = Review("eve", False, "COMMENTED", "読んだ", "c1", trusted=trusted)
            return gate.evaluate(conf, res, head="c1", commits=["c1"], commit_files={"c1": ["src/a.ts"]},
                                 reviews=[review], comments=[], codeowners=owners, toured={})[0]

        self.assertFalse(ok(False))
        self.assertTrue(ok(True))

    def test_escalate_label_makes_docs_critical(self):
        self.assertFalse(run(["docs/a.md"], escalated=True)[0])

    def test_ai_none_uses_summary(self):
        conf = {**CONF, "settings": {**CONF["settings"], "ai_reviewer": "none"}}
        self.assertFalse(run(["src/a.ts"], conf=conf)[0])
        self.assertTrue(run(["src/a.ts"], [Review(ME, False, "COMMENTED", "ok", "c1")], conf=conf)[0])


def user(login, association, kind="User"):
    return {"user": {"login": login, "type": kind}, "author_association": association}


class Collect(unittest.TestCase):
    def collect(self, reviews, comments, permissions):
        def paged(path):
            if path.endswith("/reviews"):
                return [{**r, "state": "COMMENTED", "body": "読んだ", "commit_id": "c1"} for r in reviews]
            if path.endswith("/comments"):
                return [{**c, "path": "db/x.sql", "original_commit_id": "c1"} for c in comments]
            return []

        def get(path):
            if path.endswith("/permission"):
                login = path.split("/")[-2]
                if login not in permissions:
                    raise urllib.error.HTTPError(path, 404, "not found", None, None)
                return {"permission": permissions[login]}
            return {}

        with mock.patch("github.paged", paged), mock.patch("github.get", get):
            return gate.collect("o/r", 1)

    def test_owner_counts_even_when_membership_is_private(self):
        item = user(ME, "CONTRIBUTOR")
        _, _, _, _, reviews, comments = self.collect([item], [item], {ME: "admin"})
        self.assertTrue(reviews[0].trusted)
        self.assertTrue(comments[0].trusted)

    def test_member_needs_no_permission_lookup(self):
        item = user(ME, "MEMBER")
        _, _, _, _, reviews, comments = self.collect([item], [item], {})
        self.assertTrue(reviews[0].trusted)
        self.assertTrue(comments[0].trusted)

    def test_account_without_write_is_not_trusted(self):
        item = user(ME, "NONE")
        _, _, _, _, reviews, comments = self.collect([item], [item], {ME: "read"})
        self.assertFalse(reviews[0].trusted)
        self.assertFalse(comments[0].trusted)

    def test_unknown_permission_is_not_trusted(self):
        item = user(ME, "NONE")
        _, _, _, _, reviews, _ = self.collect([item], [], {})
        self.assertFalse(reviews[0].trusted)

    def test_bot_is_not_looked_up(self):
        item = user(AI, "NONE", "Bot")
        _, _, _, _, reviews, _ = self.collect([item], [], {})
        self.assertFalse(reviews[0].trusted)


if __name__ == "__main__":
    unittest.main()
