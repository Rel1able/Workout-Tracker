import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import type { Workout } from "./types/workout";
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);

function App() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  useEffect(() => {
    async function getWorkouts() {
      const { data, error } = await supabase.from("workouts").select();
      if (error) {
        console.error(error);
        return
      }
      setWorkouts(data);
      console.log(data);
    }
    getWorkouts();
  }, []);

  return (
    <ul>
      {workouts.map((workout: Workout) => (
        <li key={workout.name}>{workout.name}</li>
      ))}
    </ul>
  );
}

export default App;
