/** Live play routes fill the viewport; prevent the app shell from scrolling underneath. */
export default function PlayRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="overflow-hidden">{children}</div>;
}
