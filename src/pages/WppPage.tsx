import { Info } from "lucide-react";
import { WppQrConnect } from "../components/WppQrConnect";

export const WppPage: React.FC = () => {
  return (
    <div className="page-container relative overflow-hidden flex flex-col space-y-8 min-h-[calc(100vh-100px)]">
      
      {/* Background Decorations */}
      <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-5%] left-[-5%] w-[30%] h-[30%] bg-blue-500/5 blur-[100px] rounded-full pointer-events-none" />



      <div className="w-full max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 relative z-10">
        <WppQrConnect />
      </div>

    </div>
  );
};
