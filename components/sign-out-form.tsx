// TODO: Remove auth functionality
export const SignOutForm = () => {
  return (
    <button
      type="button"
      className="w-full text-left px-1 py-0.5 text-red-500"
      onClick={() => {
        // TODO: Handle sign out without auth
        window.location.href = '/';
      }}
    >
      Sign out
    </button>
  );
};
