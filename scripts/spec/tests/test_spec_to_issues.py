"""Spec Kit の出力から Issue の下書きを作る変換を確かめる。

  python3 -m unittest discover -s scripts/spec/tests
"""
import pathlib
import sys
import unittest

HERE = pathlib.Path(__file__).resolve()
sys.path.insert(0, str(HERE.parents[1]))
import spec_to_issues as s  # noqa: E402

FIX = HERE.parent / "fixtures" / "001-booking"
SPEC = s.parse_spec((FIX / "spec.md").read_text(encoding="utf-8"))
PHASES = s.parse_tasks((FIX / "tasks.md").read_text(encoding="utf-8"))
DRAFTS = {d.key: d for d in s.build("001-booking", SPEC, PHASES, "specs/001-booking/spec.md", "specs/001-booking/tasks.md")}


class Parse(unittest.TestCase):
    def test_phases(self):
        self.assertEqual([p.key for p in PHASES], ["setup", "foundational", "US1", "US2", "polish"])
        self.assertEqual(PHASES[2].priority, "P1")

    def test_tasks_and_markers(self):
        setup = PHASES[0]
        self.assertTrue(setup.tasks[0].done)
        self.assertTrue(setup.tasks[1].parallel)
        self.assertEqual(PHASES[2].tasks[0].story, "US1")

    def test_dependency_section_is_not_tasks(self):
        ids = [t.id for p in PHASES for t in p.tasks]
        self.assertNotIn("T999", ids)

    def test_spec_stories(self):
        us1 = SPEC.stories["US1"]
        self.assertEqual(len(us1.scenarios), 2)
        self.assertIn("Given 空いている枠がある", us1.scenarios[0])
        self.assertFalse(us1.clarify)
        self.assertTrue(SPEC.stories["US2"].clarify)

    def test_out_of_scope_from_assumptions(self):
        self.assertEqual(len(SPEC.out_of_scope), 2)


class Build(unittest.TestCase):
    def test_one_issue_per_phase(self):
        self.assertEqual(list(DRAFTS), ["setup", "foundational", "US1", "US2", "polish"])

    def test_story_criteria_from_scenarios(self):
        b = DRAFTS["US1"].body
        self.assertIn("- [ ] Given 空いている枠がある, When 会員がその枠を予約する", b)
        self.assertIn("単独で確かめられる", b)
        self.assertIn("T005〜T006", b)

    def test_clarification_needs_decision(self):
        self.assertIn("needs:decision", DRAFTS["US2"].labels)
        self.assertNotIn("needs:decision", DRAFTS["US1"].labels)

    def test_no_criteria_needs_decision(self):
        # Polish には受け入れの条件も Checkpoint も無い
        self.assertIn("needs:decision", DRAFTS["polish"].labels)

    def test_never_agent_ready(self):
        self.assertFalse(any("agent:ready" in d.labels for d in DRAFTS.values()))

    def test_labels_and_priority(self):
        self.assertEqual(DRAFTS["US1"].labels[:2], ["feat", "p1"])
        self.assertEqual(DRAFTS["US2"].labels[:2], ["feat", "p2"])
        self.assertEqual(DRAFTS["setup"].labels[0], "chore")

    def test_dependencies(self):
        self.assertEqual(DRAFTS["setup"].depends_on, [])
        self.assertEqual(DRAFTS["foundational"].depends_on, ["setup"])
        self.assertEqual(DRAFTS["US1"].depends_on, ["foundational"])
        self.assertEqual(DRAFTS["polish"].depends_on, ["US1", "US2"])
        body = s.render_deps(DRAFTS["US1"], {"foundational": 12})
        self.assertIn("### 前提となる Issue\n\n#12", body)

    def test_marker_for_idempotency(self):
        self.assertTrue(DRAFTS["US1"].body.startswith("<!-- spec: 001-booking/US1 -->"))

    def test_links_use_repo_url(self):
        d = s.build("001-booking", SPEC, PHASES, "specs/001-booking/spec.md", "specs/001-booking/tasks.md",
                    link=lambda p: f"https://github.com/o/r/blob/main/{p}")
        self.assertIn("(https://github.com/o/r/blob/main/specs/001-booking/spec.md)", d[2].body)

    def test_global_clarifications_found(self):
        self.assertEqual(len(SPEC.clarify), 2)

    def test_sections_match_issue_template(self):
        for h in ["背景と目的", "やること", "終了条件", "やらないこと", "前提となる Issue", "参考", "判断が要る点"]:
            self.assertIn(f"### {h}", DRAFTS["US1"].body)


class IndependentTest(unittest.TestCase):
    def test_keeps_both_when_spec_and_tasks_differ(self):
        spec = s.Spec()
        spec.stories["US1"] = s.Story("1", "題", "P1", independent_test="spec の確かめ方")
        phase = s.Phase("1", "題", "US1", "story", independent_test="tasks の確かめ方",
                          tasks=[s.Task("T001", False, False, "US1", "作る")])
        body = s.build("f", spec, [phase], "s.md", "t.md")[0].body
        self.assertIn("spec の確かめ方", body)
        self.assertIn("tasks の確かめ方", body)


if __name__ == "__main__":
    unittest.main()
