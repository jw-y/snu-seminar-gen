import requests
from bs4 import BeautifulSoup
import pytz
import datetime
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

def main():
    # Fetch the latest news
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36"
    }
    session = requests.Session()
    retry = Retry(
        total=5,
        backoff_factor=1,
        status_forcelist=[502, 503, 504],
        allowed_methods=["HEAD", "GET", "OPTIONS"]
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("http://", adapter)
    session.mount("https://", adapter)

    response = session.get("https://gsds.snu.ac.kr/news/news-seminar/", headers=headers)
    soup = BeautifulSoup(response.text, "html.parser")
    element = soup.find("div", class_="loop").find("h4", class_="title").a
    url = element["href"]

    response = session.get(url, headers=headers)
    soup = BeautifulSoup(response.text, "html.parser")
    element = soup.main.find("div", class_="container")
    seoul_tz = pytz.timezone('Asia/Seoul')

    # Get the current time in Seoul
    current_time_in_seoul = datetime.datetime.now(seoul_tz).strftime("%Y-%m-%d %H:%M:%S")

    with open("latest_news.html", "w") as f:
        f.write(f"<p>Last update: {current_time_in_seoul}</p>"+str(element))

if __name__ == "__main__":
    main()