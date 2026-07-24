// 題庫資料集中管理：九宮格主題 + 每主題 5 題聊天問題
// 每個主題與問題都有穩定唯一的 id，供進度追蹤與筆記儲存 key 使用。
// 拼音一律由 pinyin.js 在畫面渲染時即時產生，這裡只放原始中文文字。

const TOPICS = [
  {
    id: "celebrity",
    zh: "名人",
    emoji: "🌟",
    color: "rose",
    questions: [
      { id: "celebrity-q1", zh: "你最喜歡哪一位名人？" },
      { id: "celebrity-q2", zh: "你為什麼喜歡他／她？" },
      { id: "celebrity-q3", zh: "你覺得成為名人有什麼好處和壞處？" },
      { id: "celebrity-q4", zh: "名人應該公開自己的私人生活嗎？" },
      { id: "celebrity-q5", zh: "如果可以和一位名人吃飯，你會選誰？想問他什麼？" },
    ],
  },
  {
    id: "place",
    zh: "地方",
    emoji: "🏙️",
    color: "amber",
    questions: [
      { id: "place-q1", zh: "你現在住在哪裡？那裡有什麼特色？" },
      { id: "place-q2", zh: "你去過最漂亮的地方是哪裡？" },
      { id: "place-q3", zh: "你比較喜歡住在城市還是鄉村？為什麼？" },
      { id: "place-q4", zh: "你的家鄉和台灣有什麼不同？" },
      { id: "place-q5", zh: "如果要向外國朋友介紹一個地方，你會推薦哪裡？" },
    ],
  },
  {
    id: "news",
    zh: "時事",
    emoji: "📰",
    color: "slate",
    questions: [
      { id: "news-q1", zh: "你平常會看新聞嗎？" },
      { id: "news-q2", zh: "你通常從哪裡獲得新聞？" },
      { id: "news-q3", zh: "最近哪一則新聞讓你印象最深刻？" },
      { id: "news-q4", zh: "你覺得社群媒體上的新聞可信嗎？" },
      { id: "news-q5", zh: "如果看到可能是假新聞的消息，你會怎麼確認？" },
    ],
  },
  {
    id: "drama",
    zh: "戲劇",
    emoji: "🎬",
    color: "violet",
    questions: [
      { id: "drama-q1", zh: "你最近看了什麼電影或影集？" },
      { id: "drama-q2", zh: "你最喜歡哪一個角色？為什麼？" },
      { id: "drama-q3", zh: "你比較喜歡喜劇、愛情劇、動作片還是恐怖片？" },
      { id: "drama-q4", zh: "你喜歡一次看完整部影集，還是慢慢看？" },
      { id: "drama-q5", zh: "如果可以進入一部戲劇的世界，你會選哪一部？" },
    ],
  },
  {
    id: "food",
    zh: "美食",
    emoji: "🍜",
    color: "orange",
    questions: [
      { id: "food-q1", zh: "你最喜歡吃什麼？" },
      { id: "food-q2", zh: "你會做哪一道菜？" },
      { id: "food-q3", zh: "你吃過最特別的食物是什麼？" },
      { id: "food-q4", zh: "台灣美食和你家鄉的美食有什麼不同？" },
      { id: "food-q5", zh: "如果要開一家餐廳，你會賣什麼？餐廳叫什麼名字？" },
    ],
  },
  {
    id: "stress",
    zh: "壓力",
    emoji: "😮‍💨",
    color: "cyan",
    questions: [
      { id: "stress-q1", zh: "最近有什麼事情讓你感到壓力？" },
      { id: "stress-q2", zh: "有壓力的時候，你的心情或身體會有什麼變化？" },
      { id: "stress-q3", zh: "你平常怎麼放鬆自己？" },
      { id: "stress-q4", zh: "你覺得適當的壓力是好事嗎？" },
      { id: "stress-q5", zh: "如果朋友壓力很大，你會怎麼安慰他？" },
    ],
  },
  {
    id: "culture",
    zh: "文化",
    emoji: "🎎",
    color: "fuchsia",
    questions: [
      { id: "culture-q1", zh: "你的國家有哪些特別的節日？" },
      { id: "culture-q2", zh: "你最喜歡自己國家的哪一種文化？" },
      { id: "culture-q3", zh: "來到台灣後，什麼事情讓你最驚訝？" },
      { id: "culture-q4", zh: "台灣和你的國家有哪些文化差異？" },
      { id: "culture-q5", zh: "如果可以讓大家體驗一項家鄉文化，你會介紹什麼？" },
    ],
  },
  {
    id: "travel",
    zh: "旅行",
    emoji: "✈️",
    color: "sky",
    questions: [
      { id: "travel-q1", zh: "你最近一次旅行去了哪裡？" },
      { id: "travel-q2", zh: "旅行時，你最重視美食、景點還是住宿？" },
      { id: "travel-q3", zh: "你比較喜歡自由行還是跟團旅行？" },
      { id: "travel-q4", zh: "旅行中發生過什麼難忘或好笑的事情？" },
      { id: "travel-q5", zh: "如果有一個月的假期和足夠的錢，你想去哪裡？" },
    ],
  },
  {
    id: "relationships",
    zh: "人際關係",
    emoji: "🤝",
    color: "emerald",
    questions: [
      { id: "relationships-q1", zh: "你喜歡認識新朋友嗎？" },
      { id: "relationships-q2", zh: "你認為好朋友需要具備什麼特質？" },
      { id: "relationships-q3", zh: "你通常怎麼和新朋友開始聊天？" },
      { id: "relationships-q4", zh: "如果朋友和你的意見不同，你會怎麼處理？" },
      { id: "relationships-q5", zh: "你覺得網路朋友可以成為真正的朋友嗎？為什麼？" },
    ],
  },
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = { TOPICS };
}
