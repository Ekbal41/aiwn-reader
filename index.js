import express from "express";
import nunjucks from "nunjucks";
import axios from "axios";
import { JSDOM } from "jsdom";
import cors from "cors";
import iconv from "iconv-lite";

const app = express();

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // Add JSON parsing for stored chapter data
app.use(express.static("public"));

nunjucks.configure("views", {
  autoescape: true,
  express: app,
});

app.get("/", (req, res) => {
  res.render("index.njk");
});

app.post("/translate", async (req, res) => {
 const { url, storedChapter } = req.body;

  if (storedChapter) {
    try {
      const { url: storedUrl, translated } = JSON.parse(storedChapter);
      return res.render("result.njk", { url: storedUrl, translated });
    } catch (err) {
      console.error("Error parsing stored chapter:", err.message);
      return res.render("index.njk", { error: "Invalid stored chapter data." });
    }
  }

  if (!url) {
    return res.render("index.njk", { error: "Please enter a URL." });
  }

  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        Referer: "https://google.com",
      },
      timeout: 10000,
      responseType: "arraybuffer",
    });

    const html = iconv.decode(response.data, "gbk");
    const dom = new JSDOM(html);
    const rawText = dom.window.document.body.textContent;

    const translated = await fetchRawAIResponse(
      `Translate the following content to English. 
      Do not explain anything or add extra text. 
      There must be no content other than chapter content.
      Only return the translated chapter starting
      from chapter number and name.
      Find the main chapter content of the novel and only return that.
      No extra thats not part od the novel chapter.
      :\n\n${rawText}`
    );

    res.render("result.njk", { url, translated });
  } catch (err) {
    console.error("Error in /translate:", err.message);
    res.render("index.njk", {
      error: "Failed to fetch/translate. Try a different URL.",
    });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

const API_KEY = "AIzaSyDtNc5d4nPnyeK8Iu8g64sYwbh8u4evc08";
const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const fetchRawAIResponse = async (prompt) => {
  if (!prompt.trim()) return;

  try {
    const res = await fetch(`${API_URL}?key=${API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: prompt }],
          },
        ],
      }),
    });

    if (!res.ok) {
      throw new Error("Failed to fetch AI response");
    }

    const data = await res.json();
    return (
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response received"
    );
  } catch (err) {
    console.error("AI API Error:", err.message);
    return "An error occurred!";
  }
};