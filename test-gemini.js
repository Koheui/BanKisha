const { GoogleGenerativeAI } = require("@google/generative-ai");

async function test() {
    const apiKey = "AIzaSyBULdve3vebMODO0A5C3CFQ8-SiLyxSaIA";
    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        console.log("Testing Gemini 2.0 Flash connectivity...");
        const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        const result = await model.generateContent("こんにちは、接続テストです。短く挨拶を返してください。");
        const response = await result.response;
        console.log("✅ API Connection Successful!");
        console.log("Response:", response.text());
    } catch (error) {
        console.error("❌ Failed to connect to Gemini API:", error.message);
    }
}

test();
