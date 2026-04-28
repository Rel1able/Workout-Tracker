import { Outlet } from "react-router";

function App() {
  return (
    <div className="h-screen bg-gray-200 flex flex-col justify-between items-center p-4">
      <header>Workout Tracker</header>
      <main>
        <Outlet />
      </main>
      <footer>Wwwww</footer>
    </div>
  );
}

export default App;
