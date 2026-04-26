#!/usr/bin/env python3
"""
ひろし専用・人生の三者審議会 (The Council of Hiroshi)
Usage:
  python main.py           # text input mode
  python main.py --voice   # microphone input mode
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any

from openai import OpenAI

from agents import AGENT_NAMES, run_council

# ---------------------------------------------------------------------------
# ANSI colour helpers
# ---------------------------------------------------------------------------
RESET = "\033[0m"
BOLD  = "\033[1m"
DIM   = "\033[2m"
CYAN  = "\033[36m"
YELLOW = "\033[33m"
MAGENTA = "\033[35m"
GREEN = "\033[32m"
BLUE  = "\033[34m"
RED   = "\033[31m"

AGENT_COLORS = {
    "accountant": YELLOW,
    "sommelier":  MAGENTA,
    "trainer":    GREEN,
}
AGENT_ICONS = {
    "accountant": "📊",
    "sommelier":  "🍷",
    "trainer":    "💪",
}

CONFIG_PATH = Path(__file__).parent / "config.json"


# ---------------------------------------------------------------------------
# Config helpers
# ---------------------------------------------------------------------------

def load_config() -> dict[str, Any]:
    if not CONFIG_PATH.exists():
        _die(
            "config.json が見つかりません。\n"
            "council/config.json にOpenAI APIキーを設定してください。"
        )

    with open(CONFIG_PATH, "r", encoding="utf-8") as f:
        config: dict[str, Any] = json.load(f)

    api_key: str = config.get("openai_api_key", "")
    if not api_key or api_key == "YOUR_API_KEY_HERE":
        api_key = os.environ.get("OPENAI_API_KEY", "")
        if not api_key:
            _die(
                "OpenAI APIキーが設定されていません。\n"
                "config.json の openai_api_key を設定するか、\n"
                "OPENAI_API_KEY 環境変数を設定してください。"
            )
        config["openai_api_key"] = api_key

    return config


def save_config(config: dict[str, Any]) -> None:
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)


def _die(msg: str) -> None:
    print(f"\n{RED}エラー: {msg}{RESET}\n")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Voice input (optional — gracefully degrades if PyAudio is absent)
# ---------------------------------------------------------------------------

def _try_voice_input() -> str | None:
    try:
        import speech_recognition as sr  # noqa: PLC0415
    except ImportError:
        print(f"{RED}speech_recognition がインストールされていません。{RESET}")
        print("pip install SpeechRecognition PyAudio でインストールしてください。")
        return None

    recognizer = sr.Recognizer()
    try:
        with sr.Microphone() as source:
            print(f"\n{CYAN}🎤 聞いています... (しばらくお待ちください){RESET}")
            recognizer.adjust_for_ambient_noise(source, duration=0.5)
            audio = recognizer.listen(source, timeout=10, phrase_time_limit=30)
    except sr.WaitTimeoutError:
        print(f"{DIM}タイムアウトしました。もう一度どうぞ。{RESET}")
        return None
    except OSError:
        print(f"{RED}マイクが見つかりません。テキスト入力モードに切り替えます。{RESET}")
        return None

    try:
        text: str = recognizer.recognize_google(audio, language="ja-JP")  # type: ignore[attr-defined]
        return text
    except sr.UnknownValueError:
        print(f"{DIM}音声を認識できませんでした。{RESET}")
        return None
    except sr.RequestError as exc:
        print(f"{RED}音声認識サービスエラー: {exc}{RESET}")
        return None


# ---------------------------------------------------------------------------
# Display helpers
# ---------------------------------------------------------------------------

def _divider(char: str = "─", width: int = 62) -> None:
    print(f"{DIM}{char * width}{RESET}")


def print_banner() -> None:
    print(f"""
{BOLD}{CYAN}╔══════════════════════════════════════════════════════════════╗
║      ひろし専用・人生の三者審議会                            ║
║      The Council of Hiroshi                                  ║
╚══════════════════════════════════════════════════════════════╝{RESET}
  {YELLOW}{BOLD}📊 経理課長・田中{RESET}      超現実主義、家計と倫理の番人
  {MAGENTA}{BOLD}🍷 AIソムリエ・アンドレ{RESET}  耽美的ナルシスト、魂の番人
  {GREEN}{BOLD}💪 脳筋トレーナー・鈴木{RESET}  体育会系、筋肉の番人
""")


def print_status(status: dict[str, Any]) -> None:
    wakeup = status.get("morning_wakeup_streak", 0)
    big3   = status.get("big3_total_kg", 320)
    target = status.get("big3_target_kg", 350)
    golf   = status.get("golf_avg_score", 102)
    wine   = status.get("wine_expert_level", "WSET Level 3")
    squat  = status.get("squat_kg", 110)
    bench  = status.get("bench_kg", 90)
    dl     = status.get("deadlift_kg", 120)

    _divider("=")
    print(f"{BOLD}  ひろしさんの現在のステータス{RESET}")
    _divider()
    print(f"  朝4時起き連続  : {CYAN}{BOLD}{wakeup}日{RESET}")
    print(
        f"  BIG3合計       : {GREEN}{BOLD}{big3}kg{RESET}"
        f" / 目標{target}kg  ({big3 / target * 100:.1f}%)"
    )
    print(f"  内訳           : SQ {squat}kg  BP {bench}kg  DL {dl}kg")
    print(f"  ゴルフ平均     : {YELLOW}{BOLD}{golf}{RESET} (目標95)")
    print(f"  ワイン資格     : {MAGENTA}{BOLD}{wine}{RESET}")
    _divider("=")
    print()


def print_council_response(results: dict[str, str]) -> None:
    for key in ("accountant", "sommelier", "trainer"):
        color = AGENT_COLORS[key]
        icon  = AGENT_ICONS[key]
        name  = AGENT_NAMES[key]
        _divider()
        print(f"{color}{BOLD}{icon} {name}:{RESET}")
        # Indent each line for readability
        for line in results[key].splitlines():
            print(f"  {line}")
        print()

    _divider("═")
    print(f"{BLUE}{BOLD}📝 審議まとめ（ひろしさんへ）:{RESET}")
    for line in results["summary"].splitlines():
        print(f"  {line}")
    _divider("═")
    print()


# ---------------------------------------------------------------------------
# Interactive status update
# ---------------------------------------------------------------------------

STATUS_FIELDS = [
    ("morning_wakeup_streak", "朝4時起き連続日数", int),
    ("squat_kg",              "スクワット (kg)",   int),
    ("bench_kg",              "ベンチプレス (kg)", int),
    ("deadlift_kg",           "デッドリフト (kg)", int),
    ("golf_avg_score",        "ゴルフ平均スコア",  int),
]


def interactive_status_update(config: dict[str, Any]) -> None:
    status: dict[str, Any] = config.setdefault("hiroshi_status", {})
    print(f"\n{BOLD}ステータスを更新します。変更しない項目はそのままEnterを押してください。{RESET}")

    for key, label, cast in STATUS_FIELDS:
        current = status.get(key, "未設定")
        raw = input(f"  {label} [{current}]: ").strip()
        if raw:
            try:
                status[key] = cast(raw)
            except ValueError:
                print(f"  {RED}無効な値です。スキップします。{RESET}")

    # Auto-recalculate BIG3 total
    sq = status.get("squat_kg", 0)
    bp = status.get("bench_kg", 0)
    dl = status.get("deadlift_kg", 0)
    if sq and bp and dl:
        status["big3_total_kg"] = sq + bp + dl

    config["hiroshi_status"] = status
    save_config(config)
    print(f"\n{GREEN}ステータスを更新しました。{RESET}")
    print_status(status)


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def main() -> None:
    print_banner()

    config = load_config()
    status: dict[str, Any] = config.setdefault("hiroshi_status", {})
    model: str = config.get("model", "gpt-4o-mini")
    client = OpenAI(api_key=config["openai_api_key"])

    use_voice = "--voice" in sys.argv or "-v" in sys.argv

    print_status(status)

    if use_voice:
        print(f"{CYAN}🎤 音声入力モードで起動しました。話しかけてください。{RESET}")
        print(f"{DIM}Ctrl+C でテキスト入力モードに切り替わります。{RESET}\n")
    else:
        print(f"{DIM}テキスト入力モード。音声入力は --voice / -v オプションで有効になります。{RESET}")
        print(
            f"コマンド: {BOLD}status{RESET}（ステータス更新）  "
            f"{BOLD}quit{RESET}（終了）\n"
        )

    while True:
        try:
            _divider()

            if use_voice:
                text = _try_voice_input()
                if text is None:
                    continue
                print(f"\n{BOLD}ひろしさん:{RESET} {text}")
                user_input = text
            else:
                raw = input(f"\n{BOLD}ひろしさん > {RESET}").strip()
                if not raw:
                    continue
                user_input = raw

            # Built-in commands
            if user_input.lower() in ("quit", "exit", "終了", "q"):
                print(f"\n{CYAN}審議会を終了します。お疲れ様でした、ひろしさん。{RESET}\n")
                break

            if user_input.lower() in ("status", "ステータス"):
                interactive_status_update(config)
                status = config["hiroshi_status"]
                continue

            if user_input.lower() in ("help", "ヘルプ", "?"):
                print(
                    f"\n{BOLD}コマンド一覧:{RESET}\n"
                    f"  status  — ひろしさんのステータスを更新\n"
                    f"  quit    — 終了\n"
                    f"  それ以外 — 三者審議会に投げかける\n"
                )
                continue

            # Run the council
            print(f"\n{DIM}審議開始...{RESET}\n")
            results, _ = run_council(client, model, user_input, status)
            print_council_response(results)

        except KeyboardInterrupt:
            if use_voice:
                print(f"\n\n{CYAN}テキスト入力モードに切り替えます。{RESET}")
                use_voice = False
            else:
                print(f"\n\n{CYAN}審議会を終了します。お疲れ様でした、ひろしさん。{RESET}\n")
                break
        except Exception as exc:
            print(f"\n{RED}エラーが発生しました: {exc}{RESET}\n")


if __name__ == "__main__":
    main()
