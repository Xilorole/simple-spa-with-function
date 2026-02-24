import type { Meta, StoryObj } from "@storybook/react";
import { MessageBubble } from "./MessageBubble";

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

export const LongMessage: Story = {
  args: {
    message: {
      role: "assistant",
      content:
        "これは長いメッセージの例です。\n\n複数の段落を含むメッセージも正しく表示されます。\n\n1. リスト項目1\n2. リスト項目2\n3. リスト項目3\n\n以上です。",
    },
  },
};
