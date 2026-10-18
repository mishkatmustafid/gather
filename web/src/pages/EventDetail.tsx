import { useParams } from "react-router-dom";

export default function EventDetail() {
  const { id } = useParams();
  return <h1 className='text-3xl font-bold'>Event {id}</h1>;
}
