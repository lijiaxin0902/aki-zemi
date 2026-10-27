"""Browser smoke test. Run a Vite server first, then: python3 tests/browser_smoke.py.

Requires Python Playwright and Chromium. Set GAME_URL / CHROMIUM_PATH if needed.
Screenshots are written outside the checkout, to /tmp/aki-zemi-browser.
"""
import json
import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright


URL = os.environ.get("GAME_URL", "http://127.0.0.1:5173")
CHROMIUM = os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium")
ARTIFACTS = Path("/tmp/aki-zemi-browser")
ARTIFACTS.mkdir(parents=True, exist_ok=True)
KEY = "yume-supporters-v1"
LABELS = {
    "study": "学習・練習", "consult": "人に相談する", "work": "アルバイトをする",
    "rest": "休息を取る", "talk": "本人と話し合う", "reflect": "現状を振り返る",
    "research": "地域のニーズを調べる", "practice": "小さな試営業をする",
    "improve": "メニューと運営を改善する", "final": "カフェを正式に開く",
}
PATH = [
    ["study", "research", "consult"], ["study", "consult", "rest"],
    ["practice", "rest"], ["improve", "work", "rest"],
    ["final", "consult", "rest"], ["reflect", "rest", "consult"],
]


def saved(page):
    return page.evaluate("key => JSON.parse(localStorage.getItem(key))", KEY)


def action(page, action_id):
    return page.locator(".action-card").filter(
        has=page.get_by_role("heading", name=LABELS[action_id], exact=True)
    )


def assert_layout(page, name, width, height=1100):
    page.set_viewport_size({"width": width, "height": height})
    page.wait_for_timeout(80)
    measurements = page.evaluate("""() => ({
      width: window.innerWidth, body: document.body.scrollWidth,
      document: document.documentElement.scrollWidth,
      outside: [...document.querySelectorAll('button,input,textarea,.panel,.action-card,.dream-card')]
        .filter(el => { const r = el.getBoundingClientRect(); return r.width && (r.left < -1 || r.right > innerWidth + 1); })
        .map(el => ({tag: el.tagName, class: el.className, text: el.textContent.slice(0, 50)}))
    })""")
    page.screenshot(path=str(ARTIFACTS / f"{name}-{width}.png"), full_page=True)
    assert measurements["body"] <= width + 1, (name, measurements)
    assert measurements["document"] <= width + 1, (name, measurements)
    assert not measurements["outside"], (name, measurements["outside"])


def next_round(page):
    page.get_by_role("button", name="次のラウンドへ →", exact=True).click()


def run():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=CHROMIUM, headless=True, args=["--no-sandbox"])
        context = browser.new_context(viewport={"width": 1440, "height": 1100})
        page = context.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
        page.goto(URL, wait_until="networkidle")
        expect(page).to_have_title("夢のサポーターズ — みんなで、夢のその先へ。")
        expect(page.locator("html")).to_have_attribute("lang", "ja")
        expect(page.locator(".dream-card")).to_have_count(3)
        expect(page.get_by_role("button", name="このチームで、夢を応援する →")).to_be_disabled()
        for index, person in [(1, "青山 凪"), (2, "高橋 奏"), (0, "森 ひなた")]:
            page.locator(".dream-card").nth(index).click()
            expect(page.locator(".character-details h2")).to_contain_text(person)
        for width in [1440, 820, 390]:
            assert_layout(page, "start", width)
        page.set_viewport_size({"width": 1440, "height": 1100})
        page.get_by_role("button", name="遊び方", exact=True).click()
        expect(page.get_by_role("dialog", name="遊び方")).to_be_visible()
        page.keyboard.press("Escape")
        expect(page.get_by_role("dialog")).to_have_count(0)
        page.get_by_placeholder("例：木もれびチーム").fill("ブラウザー検証班")
        page.get_by_role("button", name="5人", exact=True).click()
        expect(page.locator(".role-card")).to_have_count(5)
        page.get_by_role("textbox", name="計画・本人の意思担当の名前", exact=True).fill("ゆう")
        page.get_by_role("button", name="このチームで、夢を応援する →").click()
        expect(page.locator(".game-topbar")).to_contain_text("ブラウザー検証班")
        expect(page.locator(".discussion-prompts")).to_contain_text("計画・本人の意思担当 · ゆう")
        expect(action(page, "final")).to_be_disabled()
        expect(action(page, "practice")).to_be_disabled()
        confirm = page.get_by_role("button", name="この計画を実行する →", exact=True)
        expect(confirm).to_be_disabled()
        initial_stats = saved(page)["current"]["stats"]
        action(page, "study").click()
        assert saved(page)["current"]["stats"] == initial_stats
        action(page, "study").click()
        assert saved(page)["current"]["selectedActionIds"] == []
        assert saved(page)["current"]["stats"] == initial_stats
        expect(action(page, "consult")).to_contain_text("人とのつながり +15")
        for width in [1440, 820, 390]:
            assert_layout(page, "game", width)
        page.set_viewport_size({"width": 1440, "height": 1100})

        early_state = None
        for index, actions in enumerate(PATH):
            round_number = index + 1
            expect(page.locator(".round-indicator strong")).to_have_text(str(round_number))
            for action_id in actions:
                expect(action(page, action_id)).to_be_enabled()
                action(page, action_id).click()
            if round_number == 1:
                expect(action(page, "talk")).to_be_disabled()
                before_refresh = saved(page)
                page.reload(wait_until="networkidle")
                assert saved(page) == before_refresh
                for action_id in actions:
                    expect(action(page, action_id)).to_have_attribute("aria-pressed", "true")
            if round_number == 3:
                expect(confirm).to_be_disabled()
                expect(action(page, "practice")).to_contain_text("資金 −30")
                before_choice_stats = saved(page)["current"]["stats"]
                page.locator(".choice-button").nth(1).click()
                assert saved(page)["current"]["stats"] == before_choice_stats
                page.locator(".choice-button").nth(0).click()
                expect(page.locator(".budget-row").first).to_contain_text("6 / 6")
                action(page, "study").click()
                expect(confirm).to_be_disabled()
                expect(page.locator(".validation-message")).to_contain_text("時間が2点足りません")
                action(page, "study").click()
                expect(confirm).to_be_enabled()
            if round_number == 4:
                expect(action(page, "improve")).to_contain_text("時間 1")
            expect(confirm).to_be_enabled()
            # Two immediate DOM clicks exercise React's queued state updates.
            confirm.evaluate("button => { button.click(); button.click(); }")
            expect(page.locator(".result-banner") if round_number < 6 else page.locator(".results-hero")).to_be_visible()
            state = saved(page)
            assert len(state["current"]["history"]) == round_number
            assert state["current"]["round"] == round_number
            if round_number == 1:
                assert state["current"]["stats"]["money"] == 80
                assert state["current"]["stats"]["support"] == 35
                after_refresh = state
                page.reload(wait_until="networkidle")
                assert saved(page) == after_refresh
            if round_number == 5:
                expect(page.get_by_role("button", name="夢を達成したので、ここで振り返る", exact=True)).to_be_visible()
                early_state = state
            if round_number < 6:
                next_round(page)

        state = saved(page)
        assert state["current"]["status"] == "finished"
        assert state["current"]["round"] == 6
        assert len(state["results"]) == 1
        assert state["results"][0]["id"] == state["current"]["id"]
        expect(page.locator(".results-hero h1")).to_have_text("夢の実現")
        expect(page.locator(".metric-card").first).to_contain_text("100")
        expect(page.get_by_role("button", name="次のラウンドへ →", exact=True)).to_have_count(0)
        page.locator(".reflection-field textarea").nth(0).fill("相談と休息を組み合わせた支援が役立ちました。")
        page.locator(".reflection-field textarea").nth(3).fill("次は本人との対話をもっと増やしたいです。")
        page.reload(wait_until="networkidle")
        expect(page.locator(".reflection-field textarea").nth(0)).to_have_value("相談と休息を組み合わせた支援が役立ちました。")
        assert saved(page)["results"][0]["reflections"][3] == "次は本人との対話をもっと増やしたいです。"
        for width in [1440, 820, 390]:
            assert_layout(page, "results", width)
        page.set_viewport_size({"width": 1440, "height": 1100})

        # Resume a separately isolated fifth-round save and exercise the optional early ending.
        early_context = browser.new_context(viewport={"width": 1440, "height": 1100})
        early_page = early_context.new_page()
        early_page.goto(URL, wait_until="networkidle")
        early_page.evaluate("([key, state]) => localStorage.setItem(key, JSON.stringify(state))", [KEY, early_state])
        early_page.reload(wait_until="networkidle")
        early_page.get_by_role("button", name="夢を達成したので、ここで振り返る", exact=True).click()
        expect(early_page.locator(".results-hero h1")).to_have_text("夢の実現")
        assert saved(early_page)["current"]["round"] == 5
        assert len(saved(early_page)["results"]) == 1
        early_context.close()

        page.get_by_role("button", name="新しく始める", exact=True).click()
        page.get_by_role("dialog").get_by_role("button", name="戻る", exact=True).click()
        expect(page.locator(".results-hero")).to_be_visible()
        page.get_by_role("button", name="新しく始める", exact=True).click()
        page.get_by_role("dialog").get_by_role("button", name="新しく始める", exact=True).click()
        expect(page.locator(".dream-card")).to_have_count(3)
        assert len(saved(page)["results"]) == 1
        page.locator(".dream-card").nth(1).click()
        page.get_by_placeholder("例：木もれびチーム").fill("新しい漫画班")
        page.get_by_role("button", name="このチームで、夢を応援する →").click()
        assert saved(page)["current"]["dreamId"] == "manga"
        assert len(saved(page)["results"]) == 1
        page.get_by_role("button", name="みんなの記録 1", exact=True).click()
        expect(page.locator(".comparison-table tbody tr")).to_have_count(1)
        page.get_by_label("夢で絞り込む").select_option("manga")
        expect(page.locator(".empty-state")).to_be_visible()
        page.get_by_label("夢で絞り込む").select_option("cafe")
        expect(page.locator(".comparison-table tbody tr")).to_have_count(1)
        expect(page.locator(".comparison-table")).to_contain_text("ブラウザー検証班")

        page.get_by_role("button", name="この端末の記録を消去", exact=True).click()
        page.get_by_role("button", name="消去せずに戻る", exact=True).click()
        assert len(saved(page)["results"]) == 1
        page.get_by_role("button", name="この端末の記録を消去", exact=True).click()
        page.get_by_role("button", name="すべての記録を消去する", exact=True).click()
        expect(page.locator(".dream-card")).to_have_count(3)
        assert saved(page)["current"] is None
        assert saved(page)["results"] == []
        assert not errors, errors
        context.close()
        browser.close()
        print(json.dumps({"status": "passed", "flow": "cafe six rounds + early ending + save/restore + compare/reset/clear", "layouts": "start/game/results × desktop1440/tablet820/mobile390", "console_errors": errors, "screenshots": str(ARTIFACTS)}, ensure_ascii=False))


if __name__ == "__main__":
    run()
