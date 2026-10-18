import { useParams } from "react-router-dom";

export default function EditEvent() {
  const { id } = useParams();
  return <h1 className='text-3xl font-bold'>Edit event {id}</h1>;
}
