import requests
from requests.adapters import HTTPAdapter, Retry
from bs4 import BeautifulSoup
from PIL import Image
import pytesseract
from io import BytesIO
import datetime
import pytz

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
        allowed_methods=["HEAD", "GET", "OPTIONS"]
    )
    session.mount("http://", HTTPAdapter(max_retries=retry))
    session.mount("https://", HTTPAdapter(max_retries=retry))

    # Step 1: Get latest seminar post URL
    response = session.get("https://gsds.snu.ac.kr/news/news-seminar/", headers=headers)
    soup = BeautifulSoup(response.text, "html.parser")
    latest_post = soup.select_one("div.loop h4.title a")
    if not latest_post:
        raise RuntimeError("Could not find the latest post link")
    url = latest_post["href"]

    # Step 2: Fetch post detail
    response = session.get(url, headers=headers)
    soup = BeautifulSoup(response.text, "html.parser")
    content_block = soup.main.select_one("div.container")
    if not content_block:
        raise RuntimeError("Could not find seminar content block")

    # Step 3: Extract image and perform OCR
    img_tag = content_block.find("img")
    if img_tag:
        img_url = img_tag["src"]
        img_response = session.get(img_url)
        image = Image.open(BytesIO(img_response.content))
        img_text = pytesseract.image_to_string(image, lang="eng+kor")
    else:
        img_text = "[No image found for OCR]"

    # Step 4: Timestamp and write output
    now_seoul = datetime.datetime.now(pytz.timezone("Asia/Seoul"))
    timestamp = now_seoul.strftime("%Y-%m-%d %H:%M:%S")

    with open("latest_news.html", "w", encoding="utf-8") as f:
        f.write(f"<p>Last update: {timestamp}</p>\n")
        f.write(f"""\
<div style="white-space: pre-wrap; font-family: monospace; background: #f9f9f9; padding: 1em; border: 1px solid #ccc;">
{img_text}
</div>""")
        f.write(str(content_block))

if __name__ == "__main__":
    main()