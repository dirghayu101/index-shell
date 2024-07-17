const {GenerateSnippet} = require("./gemini.js")

const input = "mkdir hello-world-python"

const geminiTrial = async () => {
    const result = await GenerateSnippet(input);
    console.log(result)
}

geminiTrial();