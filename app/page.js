import { Button } from "@/components/ui/button";
import Image from "next/image";

export default function Home() {
  return (
   <>
    <div>
      Hello
    </div>
    <Button className="bg-white text-black border-2 border-blue-600 hover:bg-blue-200">Welcome</Button>
   </>
  );
}
