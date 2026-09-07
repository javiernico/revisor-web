/*
  Revisor de Bases de Licitacion - catalogo de reglas (nucleo v1)
  Espeja docs/reglas-de-revision.md y datos/reglas.json.
  Cada regla tiene: metadatos + evaluar(v) que devuelve:
    true  -> la regla dispara (hay hallazgo)
    false -> revisado, sin problema
    null  -> faltan datos para evaluarla
  Reglas con manual:true siempre se listan como "revision manual recomendada".
*/
(function () {
  "use strict";

  function b(x) { return x === "si" ? true : (x === "no" ? false : null); }
  function num(x) {
    if (x === "" || x === null || x === undefined) return null;
    var n = Number(x);
    return isNaN(n) ? null : n;
  }
  function dias(a, c) {
    if (!a || !c) return null;
    return Math.round((new Date(c) - new Date(a)) / 86400000);
  }
  // Dias habiles entre a (excluido) y c (incluido). No descuenta feriados: es aproximado.
  function diasHabiles(a, c) {
    if (!a || !c) return null;
    var d1 = new Date(a), d2 = new Date(c);
    if (d2 < d1) return -1;
    var n = 0, cur = new Date(d1.getTime() + 86400000);
    while (cur <= d2) {
      var dow = cur.getUTCDay();
      if (dow !== 0 && dow !== 6) n++;
      cur = new Date(cur.getTime() + 86400000);
    }
    return n;
  }

  var SECCIONES = [
    {
      id: "generales", titulo: "1. Datos generales",
      campos: [
        { id: "tipo_licitacion", etiqueta: "Tipo de licitacion", tipo: "select", opciones: ["", "L1", "LE", "LP", "LQ", "LR"] },
        { id: "objeto_texto", etiqueta: "Objeto de la licitacion", tipo: "texto_largo" },
        { id: "objeto_complejo", etiqueta: "El objeto es tecnicamente complejo", tipo: "booleano" }
      ]
    },
    {
      id: "plazos", titulo: "2. Plazos y calendario",
      campos: [
        { id: "fecha_publicacion", etiqueta: "Fecha de publicacion", tipo: "fecha" },
        { id: "fecha_cierre", etiqueta: "Fecha de cierre de recepcion de ofertas", tipo: "fecha" },
        { id: "plazo_minimo_aplicable", etiqueta: "Plazo minimo aplicable (dias habiles)", tipo: "numero",
          ayuda: "En dias habiles (no cuenta sabados ni domingos; los feriados se descuentan a mano). En blanco se usa: L1=5, LE=10, LP/LQ/LR=15. Confirmar el minimo vigente en el Decreto 661 y ajustar." },
        { id: "fecha_inicio_consultas", etiqueta: "Inicio del periodo de consultas", tipo: "fecha" },
        { id: "fecha_fin_consultas", etiqueta: "Fin del periodo de consultas", tipo: "fecha" },
        { id: "fecha_publicacion_respuestas", etiqueta: "Fecha de publicacion de respuestas", tipo: "fecha" }
      ]
    },
    {
      id: "presupuesto", titulo: "3. Presupuesto",
      campos: [
        { id: "hubo_consulta_mercado", etiqueta: "Se hizo consulta al mercado / RFI / 3 cotizaciones para fijar el presupuesto", tipo: "booleano" },
        { id: "monto_estimado", etiqueta: "Presupuesto estimado (CLP, imp. incl.)", tipo: "numero" },
        { id: "duracion_meses", etiqueta: "Duracion del contrato (meses)", tipo: "numero" },
        { id: "tiene_reajuste", etiqueta: "El contrato contempla reajuste de precios", tipo: "booleano" }
      ]
    },
    {
      id: "itemizado", titulo: "4. Itemizado y oferta economica",
      campos: [
        { id: "n_items_itemizado", etiqueta: "N de items del anexo economico", tipo: "numero" },
        { id: "evaluacion_item_por_item", etiqueta: "Se admite/evalua item por item", tipo: "booleano" },
        { id: "hay_banda_precios", etiqueta: "Hay banda de admisibilidad de precios respecto de un referencial", tipo: "booleano" },
        { id: "banda_inferior_pct", etiqueta: "Tolerancia hacia abajo del referencial (%)", tipo: "numero", ayuda: "Ej. 50 = se admite hasta 50% bajo el referencial." },
        { id: "banda_superior_pct", etiqueta: "Tolerancia hacia arriba del referencial (%)", tipo: "numero", ayuda: "Ej. 10 = se admite hasta 10% sobre el referencial." },
        { id: "permite_subsanar_precio", etiqueta: "Se permite aclarar errores evidentes de precio (tipeo / aritmetica)", tipo: "booleano" },
        { id: "publica_valores_referenciales", etiqueta: "Se publican los valores unitarios referenciales", tipo: "booleano" },
        { id: "oferta_decimales_estricta", etiqueta: "El anexo economico exige valores 'sin redondeos ni aproximaciones' o 'solo valen los decimales del documento presentado'", tipo: "booleano",
          ayuda: "Tipico en ofertas en UF. Sube el riesgo de que un descuadre decimal minimo vuelva inadmisible la oferta." }
      ]
    },
    {
      id: "criterios", titulo: "5. Criterios de evaluacion",
      campos: [
        { id: "criterios", etiqueta: "Criterios de evaluacion (nombre y ponderacion %)", tipo: "criterios" },
        { id: "puntaje_minimo_adjudicacion", etiqueta: "Puntaje minimo para adjudicar", tipo: "numero" },
        { id: "n_requisitos_excluyentes", etiqueta: "N de requisitos de admisibilidad excluyentes (cualquier falla = inadmisible)", tipo: "numero" },
        { id: "etapa_habilitacion_eliminatoria", etiqueta: "Hay una etapa de habilitacion / aptitud ELIMINATORIA (con puntaje minimo propio) antes de evaluar el precio", tipo: "booleano" },
        { id: "factor_habilitacion_mayor_pct", etiqueta: "Ponderacion del factor mas pesado de esa etapa de habilitacion (%)", tipo: "numero", ayuda: "Habitualmente 'Experiencia'. Dejar en blanco si no hay etapa eliminatoria." },
        { id: "capacidad_economica_pct", etiqueta: "Ponderacion del factor de capacidad / solvencia economica (%), si existe", tipo: "numero", ayuda: "Ej. tasa ingresos/gastos. Dejar en blanco si no hay ese factor." },
        { id: "geo_puntaje_max", etiqueta: "Criterio geografico: puntaje para la comuna sede", tipo: "numero", ayuda: "Dejar en blanco si no hay criterio geografico." },
        { id: "geo_puntaje_min_zona", etiqueta: "Criterio geografico: puntaje para el resto de la zona admisible", tipo: "numero" }
      ]
    },
    {
      id: "admisibilidad", titulo: "6. Admisibilidad y requisitos minimos",
      campos: [
        { id: "hay_checklist_acreditacion", etiqueta: "Hay checklist literal: cada requisito minimo indica que documento exacto lo acredita", tipo: "booleano" },
        { id: "exige_compatibilidad_total", etiqueta: "Se exige equipamiento compatible con todo el parque / flota", tipo: "booleano" },
        { id: "diversidad_objeto_alta", etiqueta: "El objeto abarca un parque / flota muy diverso (muchas marcas y modelos)", tipo: "booleano" },
        { id: "hay_restriccion_territorial", etiqueta: "Se limita la zona donde debe estar el oferente o su instalacion", tipo: "booleano" }
      ]
    },
    {
      id: "experiencia", titulo: "7. Experiencia",
      campos: [
        { id: "medios_prueba_experiencia", etiqueta: "Medios aceptados para acreditar experiencia", tipo: "multiseleccion",
          opciones: ["OC recepcion conforme", "Certificado firmado por el mandante", "Copia del contrato", "Acta de recepcion", "Factura + orden de compra", "Otros documentos fidedignos"] }
      ]
    },
    {
      id: "especificaciones", titulo: "8. Especificaciones tecnicas",
      campos: [
        { id: "menciona_marcas", etiqueta: "Las especificaciones mencionan marcas o modelos concretos", tipo: "booleano" },
        { id: "incluye_o_equivalente", etiqueta: "Incluye la formula 'o equivalente' (y no hay exclusividad justificada)", tipo: "booleano" },
        { id: "norma_version_fija", etiqueta: "Se exige una norma tecnica citada por numero Y ano de version (ej. 'NCh 1796 of. 92'), sin 'o su version vigente / la que la reemplace'", tipo: "booleano" },
        { id: "certificaciones_acumulativas", etiqueta: "Se exigen dos o mas normas / certificaciones acumulativas como requisito minimo", tipo: "booleano" },
        { id: "codigos_onu", etiqueta: "Codigos de rubro / ONU asignados al llamado", tipo: "texto" }
      ]
    },
    {
      id: "foro", titulo: "9. Foro y proceso",
      campos: [
        { id: "n_consultas_foro", etiqueta: "N de consultas recibidas en el foro (dejar en blanco si es un borrador)", tipo: "numero" },
        { id: "hubo_modificacion_bases", etiqueta: "Hubo modificacion de bases despues de publicar", tipo: "booleano" },
        { id: "hubo_prorroga_cierre", etiqueta: "Se prorrogo el cierre tras esa modificacion", tipo: "booleano" }
      ]
    }
  ];

  var LISTA = [
    {
      id: "R-01", categoria: "Plazos y calendario", nivel: "alto",
      titulo: "Plazo de publicacion bajo el minimo legal",
      norma: "Reglamento Ley 19.886 (Decreto 661/2024), plazos de publicacion.",
      descripcion: "Los dias habiles entre la publicacion y el cierre son menos que el minimo del tipo de licitacion. El calculo es aproximado: descuenta sabados y domingos pero no los feriados.",
      recomendacion: "Ampliar el plazo, o dejar constancia fundada de la rebaja en la resolucion que aprueba las bases.",
      evaluar: function (v) {
        var d = diasHabiles(v.fecha_publicacion, v.fecha_cierre);
        if (d === null || !v.tipo_licitacion) return null;
        var min = num(v.plazo_minimo_aplicable);
        if (min === null) min = (v.tipo_licitacion === "L1") ? 5 : (v.tipo_licitacion === "LE") ? 10 : 15;
        return d < min;
      }
    },
    {
      id: "R-03", categoria: "Plazos y calendario", nivel: "medio",
      titulo: "Plazo del foro de consultas insuficiente",
      norma: "Reglamento Ley 19.886; numeral 7 de bases tipo.",
      descripcion: "La ventana de consultas es muy corta, o las respuestas se publican con muy poco margen antes del cierre.",
      recomendacion: "Dar 2-3 dias habiles de consultas y publicar respuestas con margen; prorrogar el cierre si las respuestas cambian aspectos relevantes.",
      evaluar: function (v) {
        var r1 = null, r2 = null;
        var dc = dias(v.fecha_inicio_consultas, v.fecha_fin_consultas);
        if (dc !== null) r1 = dc < 2;
        var dr = dias(v.fecha_publicacion_respuestas, v.fecha_cierre);
        if (dr !== null) r2 = dr < 2;
        if (r1 === null && r2 === null) return null;
        return r1 === true || r2 === true;
      }
    },
    {
      id: "R-06", categoria: "Plazos y calendario", nivel: "informativo",
      titulo: "Publicacion en periodo de baja actividad",
      norma: "Buenas practicas ChileCompra (participacion).",
      descripcion: "La publicacion cae en septiembre, en la segunda quincena de diciembre, o en enero-febrero.",
      recomendacion: "Ampliar el plazo de recepcion de ofertas o mover la publicacion a un periodo de mayor actividad.",
      evaluar: function (v) {
        if (!v.fecha_publicacion) return null;
        var f = new Date(v.fecha_publicacion);
        var m = f.getUTCMonth() + 1, d = f.getUTCDate();
        return (m === 1 || m === 2 || m === 9) || (m === 12 && d >= 16);
      }
    },
    {
      id: "R-10", categoria: "Presupuesto", nivel: "medio",
      titulo: "Presupuesto sin respaldo de mercado",
      norma: "Buenas practicas ChileCompra; principio de eficiencia.",
      descripcion: "No se hizo consulta al mercado, RFI ni cotizaciones previas para fijar el presupuesto.",
      recomendacion: "Hacer consulta al mercado o pedir 3 cotizaciones antes de fijar el presupuesto y los valores referenciales.",
      evaluar: function (v) { var x = b(v.hubo_consulta_mercado); return x === null ? null : (x === false); }
    },
    {
      id: "R-12", categoria: "Presupuesto", nivel: "medio",
      titulo: "Contrato largo sin reajuste",
      norma: "Buenas practicas.",
      descripcion: "El contrato dura mas de 12 meses y no contempla reajuste de precios.",
      recomendacion: "Incluir un reajuste periodico (por ejemplo IPC anual).",
      evaluar: function (v) {
        var r = b(v.tiene_reajuste), m = num(v.duracion_meses);
        if (r === null || m === null) return null;
        return m > 12 && r === false;
      }
    },
    {
      id: "R-20", categoria: "Itemizado y oferta economica", nivel: "alto", origen: "Caso 2770-73-LP26",
      titulo: "Itemizado extenso evaluado item por item con banda de precios",
      norma: "Bases del comprador; principio de proporcionalidad.",
      descripcion: "El anexo economico tiene muchos items y cada valor unitario debe caer en una banda respecto de un referencial; fuera de banda = inadmisible. Con cientos de celdas, basta un puñado mal pegadas para que la oferta completa quede inadmisible.",
      recomendacion: "Reducir o agrupar el itemizado; evaluar por precio total o por una muestra representativa; ampliar la banda; permitir subsanar errores evidentes.",
      evaluar: function (v) {
        var it = num(v.n_items_itemizado), e = b(v.evaluacion_item_por_item), ba = b(v.hay_banda_precios);
        if (it === null || e === null || ba === null) return null;
        return it > 150 && e === true && ba === true;
      }
    },
    {
      id: "R-21", categoria: "Itemizado y oferta economica", nivel: "alto", origen: "Caso 2770-73-LP26",
      titulo: "Banda de admisibilidad de precios estrecha",
      norma: "Bases del comprador.",
      descripcion: "La banda es mas estrecha que [50% bajo el referencial, 10% sobre el referencial], o no hay tolerancia declarada.",
      recomendacion: "Ampliar la banda, o aplicarla solo a la sumatoria / total y no a cada item.",
      evaluar: function (v) {
        var ba = b(v.hay_banda_precios);
        if (ba !== true) return ba === null ? null : false;
        var lo = num(v.banda_inferior_pct), hi = num(v.banda_superior_pct);
        if (lo === null && hi === null) return null;
        return (lo !== null && lo < 50) || (hi !== null && hi < 10);
      }
    },
    {
      id: "R-22", categoria: "Itemizado y oferta economica", nivel: "medio", origen: "Casos 2770-73-LP26, 2770-22-LR26, 2770-46-LP26",
      titulo: "Sin subsanacion de errores de precio en la oferta economica",
      norma: "Reglamento Ley 19.886, art. 56 (salvar errores u omisiones formales); numeral 8.3.1 de bases tipo.",
      descripcion: "Las bases establecen que un error en el precio (aritmetico, celda de total en blanco, discordancia entre valor unitario y total) hace la oferta inadmisible y NO es subsanable. Es MEDIO por si solo. Sube a ALTO cuando ademas el itemizado es extenso y se evalua item por item, o hay banda de admisibilidad de precios, o se exige 'sin redondeos' sobre una oferta en UF: ahi un solo desliz de planilla elimina la oferta completa (paso en 2770-73, 2770-22 y 2770-46).",
      recomendacion: "Permitir aclarar errores aritmeticos o de transcripcion evidentes que no alteren el precio unitario ofertado ni den ventaja; entregar la plantilla Excel con formulas protegidas y una validacion que marque descuadres.",
      nivelDinamico: function (v) {
        var it = num(v.n_items_itemizado), e = b(v.evaluacion_item_por_item);
        var ba = b(v.hay_banda_precios), dec = b(v.oferta_decimales_estricta);
        if ((it !== null && it > 50 && e === true) || ba === true || dec === true) return "alto";
        return "medio";
      },
      evaluar: function (v) { var x = b(v.permite_subsanar_precio); return x === null ? null : (x === false); }
    },
    {
      id: "R-24", categoria: "Itemizado y oferta economica", nivel: "alto", origen: "Caso 2770-73-LP26",
      titulo: "Valores unitarios referenciales no publicados",
      norma: "Principio de transparencia e igualdad de los oferentes.",
      descripcion: "Hay banda de precios pero no se publican los valores referenciales contra los que se compara. El oferente oferta a ciegas y cae fuera de banda.",
      recomendacion: "Publicar el listado de valores referenciales netos junto con las bases.",
      evaluar: function (v) {
        var ba = b(v.hay_banda_precios), p = b(v.publica_valores_referenciales);
        if (ba !== true) return ba === null ? null : false;
        if (p === null) return null;
        return p === false;
      }
    },
    {
      id: "R-30", categoria: "Criterios de evaluacion", nivel: "alto",
      titulo: "Las ponderaciones no suman 100%",
      norma: "Reglamento Ley 19.886.",
      descripcion: "La suma de las ponderaciones de los criterios de evaluacion no da exactamente 100%.",
      recomendacion: "Ajustar las ponderaciones para que sumen 100%.",
      evaluar: function (v) {
        if (!v.criterios || !v.criterios.length) return null;
        var s = 0;
        for (var i = 0; i < v.criterios.length; i++) s += (num(v.criterios[i].ponderacion_pct) || 0);
        return Math.abs(s - 100) > 0.01;
      }
    },
    {
      id: "R-34", categoria: "Criterios de evaluacion", nivel: "medio", origen: "Caso 2770-73-LP26",
      titulo: "Puntaje minimo de adjudicacion alto con muchos requisitos excluyentes",
      norma: "Bases del comprador.",
      descripcion: "El puntaje minimo para adjudicar (sobre 100) es 60 o mas y ademas hay varios requisitos de admisibilidad excluyentes; riesgo de que ninguna oferta llegue a evaluacion ponderada. Un puntaje minimo por si solo NO es riesgoso (ver caso 2770-36-LR26, que lo tiene y adjudico con 3 ofertas); el riesgo aparece combinado con muchos requisitos duros, o con una etapa de habilitacion eliminatoria (ver R-36).",
      recomendacion: "Bajar el puntaje minimo, o reducir / relajar los requisitos excluyentes.",
      evaluar: function (v) {
        var pm = num(v.puntaje_minimo_adjudicacion), rq = num(v.n_requisitos_excluyentes);
        if (pm === null || rq === null) return null;
        return pm >= 60 && rq >= 3;
      }
    },
    {
      id: "R-36", categoria: "Criterios de evaluacion", nivel: "alto", origen: "Casos 2770-22-LR26, 2770-46-LP26, 2770-114-LP26",
      titulo: "Etapa de habilitacion eliminatoria con un factor de gran peso",
      norma: "Reglamento Ley 19.886, arts. 48-49 (criterios proporcionales, que no restrinjan injustificadamente la competencia).",
      descripcion: "La evaluacion tiene una etapa de habilitacion / aptitud ELIMINATORIA con puntaje minimo propio, antes de abrir el precio, y el factor mas pesado de esa etapa (habitualmente Experiencia) pondera 40% o mas con una escala que puede bajar hasta 0. Un oferente idoneo que no acredita ese factor en la forma exacta no alcanza el minimo y queda fuera sin que se evalue su precio, aunque sea el mas conveniente. Si el universo de proveedores que pueden acreditarlo es chico, la licitacion queda desierta o se adjudica sin competencia real.",
      recomendacion: "Quitar el caracter eliminatorio e integrar esos factores como criterios ponderados de una sola pauta; o bajar el umbral; o suavizar la escala para que no llegue a 0.",
      evaluar: function (v) {
        var elim = b(v.etapa_habilitacion_eliminatoria);
        if (elim === null) return null;
        if (elim === false) return false;
        var p = num(v.factor_habilitacion_mayor_pct);
        if (p === null) return null;
        return p >= 40;
      }
    },
    {
      id: "R-37", categoria: "Criterios de evaluacion", nivel: "medio", origen: "Caso 2770-46-LP26",
      titulo: "Capacidad economica de alto peso en la etapa eliminatoria",
      norma: "Principio de proporcionalidad; no discriminacion.",
      descripcion: "El factor de capacidad / solvencia economica (por ejemplo la tasa ingresos/gastos) pondera 30% o mas dentro de una etapa de habilitacion eliminatoria, con una escala que baja a 0. Muchas pymes tienen un ano con gastos mayores a ingresos (inversion, crecimiento) y siguen siendo operativamente sanas; un mal ano contable les impide pasar el umbral. En 2770-46 el adjudicatario paso la etapa 1 por 0,20 puntos por este factor.",
      recomendacion: "Usar el promedio de mas anos, bajar la ponderacion, o sacar el factor de la etapa eliminatoria y dejarlo como criterio ponderado de la pauta general.",
      evaluar: function (v) {
        var p = num(v.capacidad_economica_pct);
        if (p === null) return null;
        if (p < 30) return false;
        var elim = b(v.etapa_habilitacion_eliminatoria);
        if (elim === null) return null;
        return elim === true;
      }
    },
    {
      id: "R-35", categoria: "Criterios de evaluacion", nivel: "medio", origen: "Caso 2770-73-LP26",
      titulo: "Factor geografico con salto de puntaje excesivo",
      norma: "Principio de no discriminacion.",
      descripcion: "La comuna sede recibe el puntaje maximo y el resto de la zona admisible un puntaje mucho menor, lo que en la practica obliga a estar en la comuna.",
      recomendacion: "Suavizar la escala (por ejemplo 100 / 80 / 60) o reducir la ponderacion del factor.",
      evaluar: function (v) {
        var mx = num(v.geo_puntaje_max), mn = num(v.geo_puntaje_min_zona);
        if (mx === null || mn === null || mx <= 0) return null;
        return (mn / mx) < 0.5;
      }
    },
    {
      id: "R-40", categoria: "Admisibilidad y requisitos minimos", nivel: "alto", origen: "Caso 2770-73-LP26",
      titulo: "Requisitos minimos sin lista literal de acreditacion",
      norma: "Principio de estricta sujecion a las bases; transparencia.",
      descripcion: "Los requisitos tecnicos minimos se acreditan 'con documentacion de respaldo' pero no hay una lista literal de que documento acredita cada requisito. Un oferente con la capacidad real puede quedar inadmisible por no documentarlo con la precision esperada.",
      recomendacion: "Publicar un checklist de acreditacion: requisito -> documento exacto -> contenido minimo de ese documento.",
      evaluar: function (v) { var x = b(v.hay_checklist_acreditacion); return x === null ? null : (x === false); }
    },
    {
      id: "R-41", categoria: "Admisibilidad y requisitos minimos", nivel: "alto", origen: "Caso 2770-73-LP26",
      titulo: "Exigir equipamiento compatible con todas las marcas",
      norma: "Principio de no discriminacion; proporcionalidad.",
      descripcion: "Se exige que un equipo sea compatible con todo el parque / flota y el objeto abarca muchas marcas y modelos distintos. Casi ningun oferente puede acreditarlo sin observaciones.",
      recomendacion: "Aceptar cobertura por familias de marcas, permitir mas de un equipo, o pedir el equipo solo para las marcas mayoritarias.",
      evaluar: function (v) {
        var c = b(v.exige_compatibilidad_total), d = b(v.diversidad_objeto_alta);
        if (c === null || d === null) return null;
        return c === true && d === true;
      }
    },
    {
      id: "R-46", categoria: "Admisibilidad y requisitos minimos", nivel: "informativo", origen: "Caso 2770-73-LP26",
      titulo: "Restriccion territorial del oferente o su instalacion",
      norma: "Principio de no discriminacion; proporcionalidad.",
      descripcion: "Se limita la zona donde debe estar el oferente o su taller / instalacion (por ejemplo 'dentro de la Region Metropolitana'). Reduce la competencia; hay que verificar que sea proporcional al objeto.",
      recomendacion: "Mantener la restriccion solo si es imprescindible para el objeto (por ejemplo por logistica de traslado) y dejarlo fundado; si no, ampliar la zona.",
      evaluar: function (v) { var x = b(v.hay_restriccion_territorial); return x === null ? null : (x === true); }
    },
    {
      id: "R-50", categoria: "Experiencia", nivel: "medio", origen: "Casos 2770-73-LP26, 2770-22-LR26, 2770-46-LP26",
      titulo: "Acreditacion de experiencia por un solo medio de prueba",
      norma: "Principio de no formalizacion; igualdad.",
      descripcion: "Solo se acepta orden de compra en 'recepcion conforme' o certificado firmado por el mandante, sin admitir contratos, actas de recepcion, facturas con conformidad u otros documentos fidedignos. Es MEDIO por si solo. Sube a ALTO cuando la experiencia pondera 40% o mas, o cuando hay una etapa de habilitacion eliminatoria: ahi un proveedor con experiencia real que no tiene ese papel exacto no alcanza el minimo y queda fuera antes de que se evalue su precio (2770-73, 2770-22, 2770-46). Con ponderacion baja y sin etapa eliminatoria el efecto es acotado (2770-36-LR26 adjudico con experiencia al 25%).",
      recomendacion: "Aceptar varios medios de prueba equivalentes (contrato + factura, acta de recepcion, certificado de la ITO, declaracion jurada con respaldo verificable). Publicar ejemplos de documentos validos.",
      nivelDinamico: function (v) {
        if (b(v.etapa_habilitacion_eliminatoria) === true) return "alto";
        if (v.criterios && v.criterios.length) {
          for (var i = 0; i < v.criterios.length; i++) {
            if (/experiencia/i.test(v.criterios[i].nombre || "")) {
              var p = num(v.criterios[i].ponderacion_pct);
              if (p !== null && p >= 40) return "alto";
            }
          }
        }
        return "medio";
      },
      evaluar: function (v) {
        var m = v.medios_prueba_experiencia;
        if (!m || !m.length) return null;
        var ok = ["OC recepcion conforme", "Certificado firmado por el mandante"];
        for (var i = 0; i < m.length; i++) if (ok.indexOf(m[i]) < 0) return false;
        return true;
      }
    },
    {
      id: "R-60", categoria: "Especificaciones tecnicas", nivel: "alto",
      titulo: "Especificaciones que apuntan a una marca",
      norma: "Principio de no discriminacion; bases tipo (marcas referenciales).",
      descripcion: "Se nombra una marca o modelo concreto sin la formula 'o equivalente' y sin justificar la exclusividad.",
      recomendacion: "Describir por caracteristicas tecnicas y agregar 'o tecnicamente equivalente'.",
      evaluar: function (v) {
        var mm = b(v.menciona_marcas), oe = b(v.incluye_o_equivalente);
        if (mm === null) return null;
        if (mm === false) return false;
        if (oe === null) return null;
        return oe === false;
      }
    },
    {
      id: "R-64", categoria: "Especificaciones tecnicas", nivel: "alto", origen: "Caso 2770-63-LE25",
      titulo: "Norma tecnica exigida con version / ano fijo, sin equivalente",
      norma: "Principio de no discriminacion; DS 661/2024 (especificaciones que no restrinjan injustificadamente la competencia).",
      descripcion: "Se exige, como requisito minimo de admisibilidad, un certificado contra una norma citada por numero Y ano de version (por ejemplo 'NCh 1796 of. 92', la version de 1992), sin agregar 'o su version vigente / la que la reemplace'. Los certificados que emite el mercado suelen estar contra la version actualizada, por lo que ningun oferente cumple. En 2770-63 dejo fuera a 12 de 14 ofertas.",
      recomendacion: "Redactar 'NCh 1796 o la que la reemplace / su version vigente'. Aceptar certificados equivalentes de la version actual.",
      evaluar: function (v) { var x = b(v.norma_version_fija); return x === null ? null : (x === true); }
    },
    {
      id: "R-65", categoria: "Especificaciones tecnicas", nivel: "medio", origen: "Caso 2770-63-LE25",
      titulo: "Varias certificaciones acumulativas como requisito minimo",
      norma: "Principio de proporcionalidad.",
      descripcion: "Se exigen dos o mas normas o certificaciones de forma acumulativa como requisito de admisibilidad (por ejemplo NCh 1796 Y NCh 772-1), cuando los certificados que emite el mercado suelen cubrir solo una de ellas.",
      recomendacion: "Exigir como minimo la certificacion esencial y pedir las demas como mejora puntuable, o aceptar equivalentes. Verificar con el mercado que exista un certificado unico que las cubra todas.",
      evaluar: function (v) { var x = b(v.certificaciones_acumulativas); return x === null ? null : (x === true); }
    },
    {
      id: "R-61", categoria: "Especificaciones tecnicas", nivel: "informativo", origen: "Caso 2770-73-LP26", manual: true,
      titulo: "Revisar que el codigo de rubro / ONU represente el objeto",
      norma: "Reglamento Ley 19.886; difusion adecuada.",
      descripcion: "Si el codigo ONU es muy especifico o no representa el objeto real, la licitacion no le llega a los proveedores del giro. En el caso base se uso un codigo de 'reparacion de tren delantero o trasero' para todo un servicio de reparaciones correctivas de flota.",
      recomendacion: "Verificar manualmente que el o los codigos elegidos representen el objeto completo del servicio y lleguen a los proveedores del rubro.",
      evaluar: function () { return null; }
    },
    {
      id: "R-70", categoria: "Foro, modificaciones y proceso", nivel: "medio", origen: "Caso 2770-73-LP26",
      titulo: "Modificacion de bases sin prorroga del cierre",
      norma: "Reglamento Ley 19.886; numeral 7 de bases tipo.",
      descripcion: "Se modificaron las bases despues de publicar y no se prorrogo el plazo de recepcion de ofertas.",
      recomendacion: "Prorrogar el cierre de forma prudencial cuando la modificacion sea relevante.",
      evaluar: function (v) {
        var m = b(v.hubo_modificacion_bases), p = b(v.hubo_prorroga_cierre);
        if (m === null) return null;
        if (m === false) return false;
        if (p === null) return null;
        return p === false;
      }
    },
    {
      id: "R-71", categoria: "Foro, modificaciones y proceso", nivel: "informativo", origen: "Caso 2770-73-LP26",
      titulo: "Foro sin ninguna consulta en licitacion compleja",
      norma: "Buenas practicas ChileCompra.",
      descripcion: "No hubo consultas en el foro en una licitacion LP/LQ/LR o de objeto complejo. Nadie detecto los problemas de las bases antes del cierre.",
      recomendacion: "Revisar la claridad de las bases antes de la apertura; evaluar prorrogar el cierre; considerar una difusion adicional.",
      nivelDinamico: function (v) { return b(v.objeto_complejo) === true ? "medio" : "informativo"; },
      evaluar: function (v) {
        var c = num(v.n_consultas_foro);
        if (c === null) return null;
        var lp = ["LP", "LQ", "LR"].indexOf(v.tipo_licitacion) >= 0;
        var oc = b(v.objeto_complejo) === true;
        return c === 0 && (lp || oc);
      }
    },
    {
      id: "R-73", categoria: "Foro, modificaciones y proceso", nivel: "informativo", origen: "Caso 2770-114-LP26 (deteccion IA)", manual: true,
      titulo: "Coherencia interna: garantias, plazos y montos que se citan a si mismos",
      norma: "Ley 19.880, art. 41 (coherencia del acto); certeza juridica.",
      descripcion: "Revisar que no haya contradicciones arrastradas de plantilla. La mas comun: las bases eximen de presentar la garantia de seriedad de la oferta, pero en el numeral de formalizacion del contrato se menciona 'hacer efectivo el cobro de la garantia de seriedad de la oferta'. Tambien: montos o plazos que aparecen distintos en las bases administrativas y en las tecnicas o en los anexos.",
      recomendacion: "Buscar y eliminar toda referencia al cobro de una garantia que no se exige; cotejar montos, plazos y ponderaciones entre los documentos. El detector de texto marca la contradiccion de la garantia de seriedad si aparece.",
      evaluar: function () { return null; }
    }
  ];

  // Datos del caso base para backtesting / demostracion.
  var CASO_2770 = {
    tipo_licitacion: "LP",
    objeto_texto: "Servicios de reparaciones correctivas para vehiculos de DISAM y SMAPA",
    objeto_complejo: "si",
    fecha_publicacion: "2026-06-05",
    fecha_cierre: "2026-07-03",
    plazo_minimo_aplicable: "",
    fecha_inicio_consultas: "2026-06-05",
    fecha_fin_consultas: "2026-06-11",
    fecha_publicacion_respuestas: "",
    hubo_consulta_mercado: "",
    monto_estimado: "320000000",
    duracion_meses: "24",
    tiene_reajuste: "si",
    n_items_itemizado: "1201",
    evaluacion_item_por_item: "si",
    hay_banda_precios: "si",
    banda_inferior_pct: "50",
    banda_superior_pct: "10",
    permite_subsanar_precio: "no",
    publica_valores_referenciales: "si",
    oferta_decimales_estricta: "no",
    criterios: [
      { nombre: "Oferta economica", ponderacion_pct: "50", es_precio: true, es_binario: false, tiene_rubrica: true },
      { nombre: "Experiencia del proponente", ponderacion_pct: "15", es_precio: false, es_binario: false, tiene_rubrica: true },
      { nombre: "Ubicacion del taller", ponderacion_pct: "15", es_precio: false, es_binario: false, tiene_rubrica: true },
      { nombre: "Procedencia de los repuestos", ponderacion_pct: "15", es_precio: false, es_binario: false, tiene_rubrica: true },
      { nombre: "Cumplimiento de requisitos formales", ponderacion_pct: "4", es_precio: false, es_binario: true, tiene_rubrica: true },
      { nombre: "Programa de integridad", ponderacion_pct: "1", es_precio: false, es_binario: true, tiene_rubrica: true }
    ],
    puntaje_minimo_adjudicacion: "65",
    n_requisitos_excluyentes: "3",
    etapa_habilitacion_eliminatoria: "no",
    factor_habilitacion_mayor_pct: "",
    capacidad_economica_pct: "",
    geo_puntaje_max: "100",
    geo_puntaje_min_zona: "10",
    hay_checklist_acreditacion: "no",
    exige_compatibilidad_total: "si",
    diversidad_objeto_alta: "si",
    medios_prueba_experiencia: ["OC recepcion conforme", "Certificado firmado por el mandante"],
    menciona_marcas: "no",
    incluye_o_equivalente: "si",
    norma_version_fija: "no",
    certificaciones_acumulativas: "no",
    codigos_onu: "78180104 - Reparacion de tren delantero o trasero",
    n_consultas_foro: "0",
    hubo_modificacion_bases: "si",
    hubo_prorroga_cierre: "no"
  };

  // Segundo caso desierto (misma comuna): estudio de ingenieria, plazo de
  // publicacion muy corto. Solo tenemos la ficha de Mercado Publico; los campos
  // que dependen de las bases quedan en blanco.
  var CASO_2770_74 = {
    tipo_licitacion: "LE",
    objeto_texto: "Estudio reparacion y rehabilitacion de estanques elevados de regulacion en hormigon armado SMAPA",
    objeto_complejo: "si",
    fecha_publicacion: "2026-06-05",
    fecha_cierre: "2026-06-16",
    plazo_minimo_aplicable: "",
    fecha_inicio_consultas: "2026-06-05",
    fecha_fin_consultas: "2026-06-10",
    fecha_publicacion_respuestas: "",
    hubo_consulta_mercado: "",
    monto_estimado: "47713050",
    duracion_meses: "4",
    tiene_reajuste: "",
    n_items_itemizado: "",
    evaluacion_item_por_item: "",
    hay_banda_precios: "",
    banda_inferior_pct: "",
    banda_superior_pct: "",
    permite_subsanar_precio: "",
    publica_valores_referenciales: "",
    oferta_decimales_estricta: "",
    criterios: [
      { nombre: "Evaluacion tecnica y administrativa", ponderacion_pct: "55", es_precio: false, es_binario: false, tiene_rubrica: false },
      { nombre: "Evaluacion economica", ponderacion_pct: "45", es_precio: true, es_binario: false, tiene_rubrica: true }
    ],
    puntaje_minimo_adjudicacion: "",
    n_requisitos_excluyentes: "",
    etapa_habilitacion_eliminatoria: "",
    factor_habilitacion_mayor_pct: "",
    capacidad_economica_pct: "",
    geo_puntaje_max: "",
    geo_puntaje_min_zona: "",
    hay_checklist_acreditacion: "",
    exige_compatibilidad_total: "",
    diversidad_objeto_alta: "",
    medios_prueba_experiencia: [],
    menciona_marcas: "",
    incluye_o_equivalente: "",
    norma_version_fija: "",
    certificaciones_acumulativas: "",
    codigos_onu: "81101505 - Ingenieria estructural",
    n_consultas_foro: "",
    hubo_modificacion_bases: "",
    hubo_prorroga_cierre: ""
  };

  // Documentos que el funcionario pega como texto (borrador previo a publicar).
  var DOCUMENTOS = [
    { id: "adm", etiqueta: "Bases Administrativas" },
    { id: "tec", etiqueta: "Bases Tecnicas" },
    { id: "eco", etiqueta: "Anexos economicos / itemizado (lo que sea texto)" },
    { id: "otros", etiqueta: "Otros (respuestas a consultas, anexos, decretos, memos)" }
  ];

  // Detectores: buscan en el texto pegado clausulas tipicas de riesgo.
  // Si matchean, la regla correspondiente se marca como hallazgo y se muestra
  // la cita textual encontrada. Es deteccion asistida, NO comprension del texto.
  var DETECTORES = [
    {
      regla: "R-22", nombre: "Clausula que impide subsanar errores de precio / discordancia en el anexo economico",
      patrones: [
        /no se considerar[aá] error formal[\s\S]{0,90}precio/i,
        /error(es)?\s+(en el|de)\s+precio[\s\S]{0,90}no\s+(ser[aá]n?|se)\s+(subsan|corrig)/i,
        /(discordancia|discrepancia)\s+(u\s+omisi[oó]n\s+)?[\s\S]{0,80}(anexo|oferta)\s+econ[oó]mic[ao][\s\S]{0,80}inadmisible/i,
        /(errores|discrepancias)\s+aritm[eé]tic[ao]s[\s\S]{0,80}inadmisible/i,
        /sin\s+redondeos?\s+ni\s+aproximaciones/i
      ]
    },
    {
      regla: "R-64", nombre: "Norma tecnica exigida por numero y ano de version",
      patrones: [
        /NCh\s*\.?\s*\d+(?:[-\/]\d+)?\s*(?:of\.?|of[íi]cial)\s*\d{2,4}/i,
        /norma\s+chilena\s+\d+[\s\S]{0,25}(of\.?|of[íi]cial)\s*\d{2,4}/i
      ]
    },
    {
      regla: "R-73", nombre: "Contradiccion: se cobra una garantia de seriedad que no se exige",
      todos: true,
      patrones: [
        /no\s+requiere\s+presentaci[oó]n\s+de\s+garant[ií]a\s+de\s+seriedad/i,
        /(cobro|har[aá]\s+efectiv[oa])[\s\S]{0,60}garant[ií]a\s+de\s+seriedad\s+de\s+la\s+oferta/i
      ]
    },
    {
      regla: "R-41", nombre: "Exigencia de equipo compatible con todas las marcas",
      patrones: [
        /esc[aá]ner\s+multimarca/i,
        /compatib(le|ilidad)\s+con\s+(las\s+)?(todas\s+las\s+)?marcas/i
      ]
    },
    {
      regla: "R-20", nombre: "Banda de admisibilidad de precios sobre el itemizado",
      patrones: [
        /valor(es)?\s+unitario(s)?\s+(neto(s)?\s+)?referencial(es)?/i,
        /(50)\s*%\s*(del|de los)\s+valor(es)?\s+(unitario|referencial)/i
      ]
    },
    {
      regla: "R-50", nombre: "Experiencia solo por OC recepcion conforme o certificado del mandante",
      todos: true,
      patrones: [
        /orden(es)?\s+de\s+compra[\s\S]{0,120}recepci[oó]n\s+conforme/i,
        /certificad(o|os)[\s\S]{0,130}(firmad|suscrit)[\s\S]{0,30}(mandante|mandantes)/i
      ]
    },
    {
      regla: "R-46", nombre: "Restriccion territorial del oferente o su instalacion",
      patrones: [
        /taller[\s\S]{0,60}(dentro de|ubicad[oa] en)\s+la\s+regi[oó]n\s+metropolitana/i,
        /regi[oó]n\s+metropolitana[\s\S]{0,40}(el taller|instalaci|domicili)/i
      ]
    }
  ];

  window.REGLAS = {
    version: "2", secciones: SECCIONES, lista: LISTA,
    documentos: DOCUMENTOS, detectores: DETECTORES,
    casoDemo: CASO_2770,
    casosDemo: { "2770-73-LP26": CASO_2770, "2770-74-LE26": CASO_2770_74 }
  };
})();
