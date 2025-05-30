import express from "express";
import nunjucks from "nunjucks";
import axios from "axios";
import { JSDOM } from "jsdom";
import cors from "cors";
import iconv from "iconv-lite";

const app = express();

app.use(cors());
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static("public"));

nunjucks.configure("views", {
  autoescape: true,
  express: app,
});

app.get("/", (req, res) => {
  res.render("index.njk");
});

app.get("/api-key", (req, res) => {
  res.render("api-key.njk");
});

app.post("/translate", async (req, res) => {
  const { url, storedChapter, apiKey } = req.body;

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

  if (!apiKey) {
    return res.render("index.njk", { error: "Please set an API key first." });
  }

  try {
    const response = await axios.get(url, {
      headers: {
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
      Only return the translated chapter starting from chapter number and name.
      Find the main chapter content of the novel and only return that.
      No extra text that are not part of the novel chapter.
      Always translate to "english" no matter what the source lang is.
      :\n\n${rawText}`,
      apiKey
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

const API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const fetchRawAIResponse = async (prompt, apiKey) => {
  if (!prompt.trim() || !apiKey) return;

  try {
    const res = await fetch(`${API_URL}?key=${apiKey}`, {
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
    return "An error occurred, API key is not valid!";
  }
};
