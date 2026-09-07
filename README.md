# Revisor de Bases de Licitación — app web

Versión publicable (solo la app) del proyecto A+S para SMAPA / DISAM, I.
Municipalidad de Maipú.

Herramienta para revisar borradores de bases de licitación antes de publicarlas en
Mercado Público y reducir el riesgo de que el proceso quede desierto.

## Uso

Abrir la URL de GitHub Pages en cualquier navegador (PC o celular).

- **Flujo con IA**: requiere internet y una clave de API (Google Gemini gratis en
  https://aistudio.google.com/apikey, o Anthropic Claude de pago). La clave se
  ingresa en cada dispositivo y queda guardada solo en ese navegador. **Nunca va
  en el código.**
- **Flujo sin IA**: pegar el texto de las bases + completar el formulario. Motor
  de reglas local, funciona sin conexión.

## Contenido

- `index.html` — la aplicación.
- `reglas.js` — catálogo de reglas del motor local (v2).

El desarrollo, los casos de referencia y la documentación viven en el repositorio
principal `revisor-licitaciones` (privado).
