import { ChatWindow } from "./components/ChatWindow";

export default function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl h-[80vh]">
        <ChatWindow />
      </div>
    </div>
  );
}
