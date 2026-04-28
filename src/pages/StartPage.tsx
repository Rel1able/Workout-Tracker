import { Link } from "react-router";
import { useEffect, useState } from "react";
import supabase from "../lib/supabase";
import type { Workout } from "../types/workout";

export default function StartPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  useEffect(() => {
    async function getWorkouts() {
      const { data, error } = await supabase.from("workouts").select();
      if (error) {
        console.error(error);
        return;
      }
      setWorkouts(data);
      console.log(data);
    }
    getWorkouts();
  }, []);
  return (
    <>
      <div>
        <h1>Select your workout</h1>
        <ul>
          {workouts.map((workout) => (
            <li key={workout.id}>
              <Link to={`workout/${workout.name}`}>{workout.name}</Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
