import type { Meta, StoryObj } from "@storybook/react";
import { MessageBubble, TypingIndicator } from "./MessageBubble";

const meta = {
  title: "Components/MessageBubble",
  component: MessageBubble,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MessageBubble>;

export default meta;
type Story = StoryObj<typeof meta>;

export const UserMessage: Story = {
  args: {
    message: {
      role: "user",
      content: "こんにちは！Azure OpenAIについて教えてください。",
    },
  },
};

export const AssistantMessage: Story = {
  args: {
    message: {
      role: "assistant",
      content:
        "こんにちは！Azure OpenAIは、MicrosoftのAzureクラウド上でOpenAIのモデルを利用できるサービスです。GPT-4やDALL-Eなどのモデルにアクセスでき、エンタープライズレベルのセキュリティとコンプライアンスが提供されます。",
    },
  },
};

export const MarkdownMessage: Story = {
  args: {
    message: {
      role: "assistant",
      content: `## Azure OpenAIの特徴

以下の機能が含まれます:

- **GPT-4** / **GPT-4o** モデル
- DALL-E による画像生成
- Whisper による音声認識

### コード例

\`\`\`python
import openai

client = openai.AzureOpenAI(
    azure_endpoint="https://my-resource.openai.azure.com",
    api_key="your-key",
    api_version="2024-02-01",
)

response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello!"}],
)
print(response.choices[0].message.content)
\`\`\`

> 詳しくは [公式ドキュメント](https://learn.microsoft.com/azure/ai-services/openai/) をご覧ください。

| モデル | 用途 |
|--------|------|
| GPT-4  | テキスト生成 |
| DALL-E | 画像生成 |
| Whisper | 音声認識 |`,
    },
  },
};

export const LongMessage: Story = {
  args: {
    message: {
      role: "assistant",
      content:
        "これは長いメッセージの例です。\n\n複数の段落を含むメッセージも正しく表示されます。\n\n1. リスト項目1\n2. リスト項目2\n3. リスト項目3\n\n以上です。",
    },
  },
};

export const SyntaxHighlighted: Story = {
  args: {
    message: {
      role: "assistant",
      content: `TypeScriptの例:

\`\`\`typescript
interface User {
  id: number;
  name: string;
  email: string;
}

async function fetchUser(id: number): Promise<User> {
  const res = await fetch(\`/api/users/\${id}\`);
  if (!res.ok) throw new Error("Not found");
  return res.json();
}
\`\`\`

HTMLも対応しています:

\`\`\`html
<div class="container">
  <h1>Hello World</h1>
  <p>This is a paragraph.</p>
</div>
\`\`\``,
    },
  },
};

export const MathMessage: Story = {
  args: {
    message: {
      role: "assistant",
      content: `二次方程式の解の公式は:

$$
x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
$$

ここで $a$, $b$, $c$ は係数です。

オイラーの等式: $e^{i\\pi} + 1 = 0$

ガウス積分:

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$`,
    },
  },
};

export const Loading: StoryObj = {
  render: () => <TypingIndicator />,
  parameters: { layout: "centered" },
};
