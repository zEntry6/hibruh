const Spinner = ({ size = 20 }) => (
  <div
    className="inline-block animate-spin rounded-full border-2 border-woy-accent border-t-transparent"
    style={{ width: size, height: size }}
  />
);

export default Spinner;
