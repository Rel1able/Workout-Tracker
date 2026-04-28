import { useParams } from "react-router";
import supabase from "../lib/supabase";
import { useState, useEffect } from "react";
import type { Workout } from "../types/workout";

export default function Workout() {
  const [workout, setWorkout] = useState<Workout[]>();
  const { name } = useParams();

  useEffect(() => {
    async function getWorkoutData() {
      const { data, error } = await supabase
        .from("workout_exercises")
        .select(
          `
        *,
        workouts!inner ( name ),
        exercises ( name, weight )
      `,
        )
        .eq("workouts.name", name);
      if (error) {
        return;
      }
      setWorkout(data);
      console.log(data);
    }
    getWorkoutData();
  }, []);

  return (
    <>
      <h1>{name}</h1>
    </>
  );
}
