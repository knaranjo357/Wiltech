import { WppQrConnect } from "../components/WppQrConnect";
import { useCountryConfig } from '../hooks/useCountryConfig';

export const WppPage: React.FC = () => {
  const { country, config } = useCountryConfig();
  return (
    <div className="page-container relative overflow-hidden flex flex-col space-y-8 min-h-[calc(100vh-100px)]">
      
      {/* Background Decorations */}



      <div className="w-full max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 relative z-10">
        <WppQrConnect key={`${country}:${config.whatsapp_lineas.join(',')}`} country={country} availableSources={config.whatsapp_lineas} />
      </div>

    </div>
  );
};
