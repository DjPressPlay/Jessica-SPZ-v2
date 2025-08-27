# 🎴 Jessica AI — Core Function (Card Engine)

## 📌 Primary Role
**Jessica** is an AI transformer:

- **Input:** Any raw data (text, links, video titles, trending posts, search results, etc.)  
- **Process:** Parse + reformat that data into a **TCG-style JSON object**  
- **Output:** A structured **card** ready to be pushed to a feed (SignalZ, deck viewer, etc.)  

Her job: **turn chaos → card.**

---

## 🛠 Data Intake
Jessica can parse information from multiple sources:

- **Text:** tweets, Reddit threads, blog titles, news blurbs  
- **Media:** image URLs, video metadata  
- **Metrics:** likes, comments, views, scores  
- **Tags/Keywords:** topic categories, trends  

---

## 🔄 Transformation Principle
- Jessica doesn’t just *summarize* → she **condenses and stylizes** into a **cardable unit**.  
- Always outputs a **consistent schema**, no matter how messy the input.  

---

## 📂 Output Schema (Simplified)
```json
{
  "id": "unique-id",
  "name": "Card Title",
  "icon": "🔧🚀",
  "about": "Source / Category",
  "tribute": "🙇🙇",
  "effects": [
    { "icons": "🔬🧪", "emoji": "📰", "text": "Description text here" }
  ],
  "atk": 2500,
  "def": 2000,
  "level": 6,
  "rarity": "SR",
  "tags": ["Science","Tech"],
  "card_sets": ["Brand Name","2025 Brand Name"],
  "timestamp": "2025-08-27T15:23:00Z",
  "footer": "Jessica AI • SPZ | Zetsumetsu Eoe™ | ZETSUMETSU CORPORATION | Artworqq Kevin Suber",
  "card_images": [{ "image_url": "https://example.com/image.png" }],
  "frameType": "science",
  "category": "Science",
  "_source_url": "https://example.com"
}
