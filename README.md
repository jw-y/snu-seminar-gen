# SNU Seminar Generator

Web app and scheduled scraper for generating a seminar reflection document (`.docx`) from user inputs and optional AI-assisted autofill.

## Repository structure

```text
.
├─ frontend/
│  ├─ index.html
│  ├─ latest_news.html
│  └─ src/
│     ├─ ai.js
│     └─ main.js
├─ scripts/
│  └─ fetch_latest.py
├─ .github/workflows/scheduled.yml
├─ pyproject.toml
└─ uv.lock
```

## What it does

- Fetches the latest seminar announcement from GSDS and stores it in `frontend/latest_news.html`.
- Performs OCR on the seminar poster image and combines OCR + notice text.
- Lets users generate a formatted seminar report in Word format.
- Optionally uses Gemini or OpenAI to auto-fill title/speaker/summary/reflection.

## Local usage

1. Serve the `frontend/` directory with any static server.
2. Open `index.html` in a browser.
3. Fill in the form and click `Generate Document`.
4. Optionally select an AI provider/model, enter an API key, and click `Generate` to auto-fill fields first.

Example static server:

```bash
cd frontend
python -m http.server 8000
```

Then open [http://localhost:8000](http://localhost:8000).

## Updating seminar source data

`scripts/fetch_latest.py` writes `frontend/latest_news.html` by:

1. Fetching the latest seminar list page.
2. Following the newest seminar post link.
3. OCR-ing the first poster image (`eng+kor`).
4. Saving OCR text + seminar content HTML.

Run locally:

```bash
uv sync
uv run python scripts/fetch_latest.py
```

## GitHub Actions schedule

Workflow file: `.github/workflows/scheduled.yml`

- Runs weekly (Wednesday KST morning).
- Installs Tesseract and Korean language data.
- Runs `scripts/fetch_latest.py`.
- Commits `frontend/latest_news.html` if it changed.

## Notes and limitations

- AI output quality depends on OCR quality and announcement content.
- API keys are used client-side only and are not sent to this repo's server.
- `frontend/latest_news.html` is treated as trusted generated content from your own pipeline.
