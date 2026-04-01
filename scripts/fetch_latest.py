import datetime
from io import BytesIO
from pathlib import Path
from urllib.parse import urljoin

import pytesseract
import pytz
import requests
from bs4 import BeautifulSoup
from PIL import Image
from requests.adapters import HTTPAdapter, Retry

REQUEST_TIMEOUT = 20
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "frontend" / "latest_news.html"


def main():
    # Session setup with retries
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36"
        )
    }
    session = requests.Session()
    retry = Retry(
        total=5,
        backoff_factor=1,
        status_forcelist=[502, 503, 504],
        allowed_methods=["HEAD", "GET", "OPTIONS"],
    )
    session.mount("http://", HTTPAdapter(max_retries=retry))
    session.mount("https://", HTTPAdapter(max_retries=retry))

    # Step 1: Get latest seminar post URL
    response = session.get(
        "https://gsds.snu.ac.kr/news/news-seminar/",
        headers=headers,
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    latest_post = soup.select_one("div.loop h4.title a")
    if not latest_post:
        raise RuntimeError("Could not find the latest post link")
    url = latest_post["href"]

    # Step 2: Fetch post detail
    response = session.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    if soup.main is None:
        raise RuntimeError("Could not find <main> in seminar page")

    content_block = soup.main.select_one("div.container")
    if not content_block:
        raise RuntimeError("Could not find seminar content block")

    # Step 3: Extract image and perform OCR
    img_tag = content_block.find("img")
    if img_tag:
        img_url = urljoin(url, img_tag["src"])
        img_response = session.get(img_url, headers=headers, timeout=REQUEST_TIMEOUT)
        img_response.raise_for_status()
        image = Image.open(BytesIO(img_response.content))
        img_text = pytesseract.image_to_string(image, lang="eng+kor")
    else:
        img_text = "[No image found for OCR]"

    # Step 4: Timestamp and write output
    now_seoul = datetime.datetime.now(pytz.timezone("Asia/Seoul"))
    timestamp = now_seoul.strftime("%Y-%m-%d %H:%M:%S")
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        f.write(f"<p>Last update: {timestamp}</p>\n")
        f.write(
            f"""\
<div style="white-space: pre-wrap; font-family: monospace; background: #f9f9f9; padding: 1em; border: 1px solid #ccc;">
{img_text}
</div>"""
        )
        f.write(str(content_block))


if __name__ == "__main__":
    main()
