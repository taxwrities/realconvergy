# Morning board — cheat sheet

1. `python scripts/run-board.py --commit` — pre-Zach board (before games), pushed to GitHub.
2. Zach posts → drop his numbers into `data/themes/board-theme-{date}.json` (copy `data/themes/board-theme-template.json`; phone-friendly via GitHub web editor).
3. `python scripts/run-board.py --retheme --commit` — post-Zach themed board, pushed.
4. Chat fetch: `https://raw.githubusercontent.com/taxwrities/realconvergy/main/data/boards/{date}.txt` (themed: `{date}-themed.txt`).
5. npm shortcuts: `npm run board` / `npm run retheme`.
