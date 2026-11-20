export default function ZenoxiWordmark({ className = "" }) {
  return (
    <span className={`zenoxi-wordmark ${className}`} role="img" aria-label="Zenoxi">
      <span aria-hidden="true">Zen</span>
      <img className="zenoxi-wordmark-orb" src="/zenoxi-orb.svg" width="402" height="236" alt="" />
      <span aria-hidden="true">xi</span>
    </span>
  );
}
