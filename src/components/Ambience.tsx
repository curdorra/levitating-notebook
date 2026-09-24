import { LeafShadows } from "./LeafShadows";
import { ReverieScene } from "./ReverieScene";
import { SpecimenScene } from "./SpecimenScene";

/**
 * Fixed backdrop behind the whole app. All three themes are rendered;
 * themes.css shows the one matching <html data-theme>, so switching themes
 * is instant and needs no re-render. Hidden themes are display:none, so
 * their animations cost nothing.
 */
export function Ambience() {
  return (
    <div className="ambience" aria-hidden="true">
      <div className="amb amb-linen">
        <div className="linen-light" />
        <LeafShadows />
      </div>

      <div className="amb amb-specimen">
        <SpecimenScene />
      </div>

      <div className="amb amb-reverie">
        <ReverieScene />
      </div>

      <div className="grain" />
    </div>
  );
}
