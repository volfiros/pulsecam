export default function PulseRing() {
  return (
    <div className="flex items-center justify-center" style={{ width: 200, height: 64 }}>
      <svg viewBox="0 0 200 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polyline
          points="0,32 30,32 40,32 48,32 54,12 60,52 66,20 72,44 78,32 90,32 100,32 110,32 118,32 124,12 130,52 136,20 142,44 148,32 160,32 170,32 180,32 186,12 192,52 198,20 204,44 210,32 230,32"
          stroke="#10b981"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="280"
          strokeDashoffset="280"
          opacity="0.3"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="280"
            to="0"
            dur="1.8s"
            repeatCount="indefinite"
          />
        </polyline>
        <polyline
          points="0,32 30,32 40,32 48,32 54,12 60,52 66,20 72,44 78,32 90,32 100,32 110,32 118,32 124,12 130,52 136,20 142,44 148,32 160,32 170,32 180,32 186,12 192,52 198,20 204,44 210,32 230,32"
          stroke="#10b981"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="60"
          strokeDashoffset="60"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="60"
            to="-280"
            dur="2s"
            repeatCount="indefinite"
          />
        </polyline>
      </svg>
    </div>
  );
}
