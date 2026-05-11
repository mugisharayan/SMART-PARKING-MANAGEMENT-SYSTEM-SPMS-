import { useEffect, useState } from "react";
import axios from "axios";

function App() {

  const [message, setMessage] = useState("");

  useEffect(() => {
    axios.get("http://localhost:5000")
    .then((res) => {
      setMessage(res.data);
    });
  }, []);

  return (
    <div>
      <h1>{message}</h1>
    </div>
  );
}

export default App;