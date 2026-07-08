import { redirect } from 'next/navigation'

// Den offentlige utleieportalen er fjernet (Fase A). Roten sender nå
// rett til admin — som selv viser innlogging hvis du ikke har sesjon.
export default function Forside() {
  redirect('/admin')
}
