import type { Meta, StoryObj } from "@storybook/react";
import { ChatWindow } from "./ChatWindow";

const meta = {
  title: "Components/ChatWindow",
  component: ChatWindow,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl h-[80vh]">
          <Story />
        </div>
      </div>
    ),
  ],
} satisfies Meta<typeof ChatWindow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
