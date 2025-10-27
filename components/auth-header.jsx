export default function AuthHeader() {
  return (
    <div className="mt-2 flex items-center justify-end gap-3 px-6 py-3 text-lg rounded-full bg-gradient-to-r from-grey-600 to-indigo-600 text-white shadow-lg  transform transition ">
      <button className="flex items-center gap-3 px-6 py-3 text-lg rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg hover:scale-105 transform transition">
        Login
      </button>
      <button className="flex items-center gap-3 px-6 py-3 text-lg rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg hover:scale-105 transform transition">
        Sign Up
      </button>
    </div>
  );
}
