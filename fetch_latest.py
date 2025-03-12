import requests
from bs4 import BeautifulSoup
import pytz
import datetime

def main():
    # Fetch the latest news
    response = requests.get("https://gsds.snu.ac.kr/news/news-seminar/")
    soup = BeautifulSoup(response.text, "html.parser")
    element = soup.find("div", class_="loop").find("h4", class_="title").a
    url = element["href"]

    response = requests.get(url)
    soup = BeautifulSoup(response.text, "html.parser")
    element = soup.main.find("div", class_="container")
    seoul_tz = pytz.timezone('Asia/Seoul')

    # Get the current time in Seoul
    current_time_in_seoul = datetime.datetime.now(seoul_tz).strftime("%Y-%m-%d %H:%M:%S")

    with open("latest_news.html", "w") as f:
        f.write(f"<p>Last update: {current_time_in_seoul}</p>"+str(element))

if __name__ == "__main__":
    main()