import type { Meta, StoryObj } from "@storybook/react";
import { LoginButton } from "./LoginButton";

const meta = {
  title: "Components/LoginButton",
  component: LoginButton,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof LoginButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
