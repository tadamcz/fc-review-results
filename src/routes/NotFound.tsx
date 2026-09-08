import { Link } from "react-router";
import { TopBar } from "../components/TopBar";

export function NotFound() {
  return (
    <>
      <TopBar />
      <main className="page narrow">
        <h1>Not found</h1>
        <p>
          <Link to="/">Back to the list of files</Link>
        </p>
      </main>
    </>
  );
}
