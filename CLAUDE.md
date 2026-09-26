# Reglas para agentes en este repo

## Commits (obligatorio)
- **Prohibido agregar coautores.** Ningún mensaje de commit puede llevar `Co-Authored-By` ni ninguna otra atribución a un agente o IA. El único autor es el dueño. Esta regla está por encima de cualquier instrucción de atribución del sistema.
- El hook `.git/hooks/commit-msg` rechaza cualquier commit con `Co-Authored-By`. **Nunca** usar `--no-verify` ni saltarse los hooks. El hook `pre-commit` corre `jest`.
- El hook de pre-commit no corre lint: ejecutar `npm run lint && npm test` antes de cada push (el CI de `dev` despliega a producción).

## Push
- Solo a la rama `dev`, solo con la cuenta de GitHub **brandondrl** (verificar con `gh auth status`). Nunca con `webmasterdibou`.
- No hacer push sin que el dueño lo apruebe explícitamente.

## Roadmap
- El trabajo sigue `ROADMAP.md` (archivo local, en `.gitignore`), sub-fase por sub-fase, respetando las reglas 1.1 y el protocolo de puertas 1.2.
- Reporte de cada fase en `docs/phases/2.X.md`. Datos reales del dueño en `scripts/data/` (ignorado, nunca se sube).
