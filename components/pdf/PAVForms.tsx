import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';
import { LOGO_PAV_HEADER } from './logoBase64';

const styles = StyleSheet.create({
  page: {
    paddingTop: 32,
    paddingBottom: 38,
    paddingHorizontal: 48,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.4,
    position: 'relative',
  },
  headerLogoContainer: {
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  headerLogo: {
    width: 440,
    height: 55,
  },
  rightExpBox: {
    alignItems: 'flex-end',
    marginBottom: 14,
  },
  expText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9.5,
    lineHeight: 1.3,
  },
  title: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 9,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 2,
    color: '#111',
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#666',
    marginTop: 6,
    marginBottom: 12,
  },
  boxBordered: {
    borderWidth: 1.2,
    borderColor: '#000',
    padding: 12,
    minHeight: 450,
  },
  boxTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9.5,
  },
  bodyText: {
    fontSize: 9.5,
    lineHeight: 1.45,
  },
  bold: {
    fontFamily: 'Helvetica-Bold',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    textAlign: 'center',
    fontSize: 8.5,
    fontFamily: 'Helvetica-Bold',
    color: '#000',
  },
});

export interface PAVData {
  nombreCompleto: string;
  dni: string;
  cargo?: string;
  programa?: string;
  secretaria?: string;
  nroExpPasividad?: string;
  fSolicitud?: string;
  fechaActual?: string;
  cuil?: string;
  nroExpMunRenuncia?: string;
  fBaja?: string;
  nroResRenCaja?: string;
  jNroExpCaja?: string;
  fechaDesdeProv?: string;
  fechaHastaProv?: string;
}

// ── 1. FORMULARIO DE ACEPTACIÓN / RECHAZO PAV ────────────────────────────────
export const PavAceptacionRechazo = ({ data }: { data: PAVData }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Logos institucionales centrados y más grandes */}
      <View style={styles.headerLogoContainer}>
        <Image src={LOGO_PAV_HEADER} style={styles.headerLogo} />
      </View>

      {/* Expediente y fecha a la derecha sin corchetes */}
      <View style={styles.rightExpBox}>
        <Text style={styles.expText}>
          Nro EXPEDIENTE: {data.nroExpPasividad || ''}
        </Text>
        <Text style={[styles.expText, { marginTop: 3 }]}>
          FECHA INICIO EXPEDIENTE: {data.fSolicitud || ''}
        </Text>
      </View>

      {/* Título */}
      <Text style={styles.title}>Formulario de Aceptación/Rechazo PAV</Text>
      <Text style={styles.subtitle}>Ley Provincial Nº 8836 - Ordenanza Nº 10,514 - Decreto Nº 1282</Text>

      {/* Línea divisoria */}
      <View style={styles.divider} />

      {/* Recuadro de Autoridad Superior */}
      <View style={styles.boxBordered}>
        <Text style={styles.boxTitle}>* PARA USO EXCLUSIVO DE LA AUTORIDAD SUPERIOR:</Text>

        <Text style={[styles.bodyText, { marginTop: 12 }]}>
          Respecto a la &quot;Solicitud de Acogimiento de la Pasividad Anticipada Voluntaria&quot; de foja 1, del Agente:{' '}
          <Text style={styles.bold}>{data.nombreCompleto}</Text> DNI Nº <Text style={styles.bold}>{data.dni}</Text>
        </Text>

        <Text style={[styles.bodyText, { marginTop: 10 }]}>Perteneciente a la reparticón:</Text>
        <Text style={[styles.bodyText, styles.bold, { marginTop: 2 }]}>
          {data.programa || ''}
        </Text>

        <Text style={[styles.bodyText, { marginTop: 10 }]}>En el cargo:</Text>
        <Text style={[styles.bodyText, styles.bold, { marginTop: 2 }]}>
          {data.cargo || ''}
        </Text>

        <Text style={[styles.bodyText, { marginTop: 12 }]}>
          La presente solicitud afecta la continuidad o calidad del sevicio:{' '}
          <Text style={{ fontStyle: 'italic', fontSize: 8.5 }}>(Marcar con una cruz según corresponda)</Text>
        </Text>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 60, marginTop: 14 }}>
          <Text style={[styles.bodyText, styles.bold]}>NO AFECTA   [   ]</Text>
          <Text style={[styles.bodyText, styles.bold]}>SI AFECTA   [   ]</Text>
        </View>

        <Text style={[styles.bodyText, { marginTop: 16 }]}>
          Resolviendo en consecuencia que la presente solicitud:
        </Text>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 60, marginTop: 14 }}>
          <Text style={[styles.bodyText, styles.bold]}>ES ACEPTADA   [   ]</Text>
          <Text style={[styles.bodyText, styles.bold]}>ES RECHAZADA   [   ]</Text>
        </View>

        <Text style={[styles.bodyText, { marginTop: 22 }]}>
          CÓRDOBA, _____ / _____ / _________
        </Text>

        <View style={{ marginTop: 45, alignItems: 'center' }}>
          <View style={{ width: 250, borderBottomWidth: 1, borderBottomColor: '#666', marginBottom: 4 }} />
          <Text style={{ fontSize: 8.5 }}>Firma del DIRECTOR o AUTORIDAD</Text>
          <Text style={{ fontSize: 8.5 }}>SUPERIOR</Text>
        </View>
      </View>

      {/* Sello fuera del recuadro a la derecha */}
      <View style={{ alignItems: 'flex-end', marginTop: 8 }}>
        <Text style={{ fontSize: 8.5 }}>SELLO del DIRECTOR o AUTORIDAD SUPERIOR</Text>
      </View>

      {/* Pie de página institucional */}
      <Text style={styles.footer}>Chacabuco 737 – subsecretaria.capitalhumano@cordoba.gov.ar</Text>
    </Page>
  </Document>
);

// ── 2. PASE A SECRETARÍA ─────────────────────────────────────────────────────
export const PavPaseSecretaria = ({ data }: { data: PAVData }) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Logos institucionales centrados y más grandes */}
      <View style={styles.headerLogoContainer}>
        <Image src={LOGO_PAV_HEADER} style={styles.headerLogo} />
      </View>

      {/* Expediente y fecha a la derecha sin corchetes */}
      <View style={[styles.rightExpBox, { marginBottom: 28 }]}>
        <Text style={styles.expText}>
          Nro EXPEDIENTE: {data.nroExpPasividad || ''}
        </Text>
        <Text style={[styles.expText, { marginTop: 3 }]}>
          FECHA INICIO EXPEDIENTE: {data.fSolicitud || ''}
        </Text>
      </View>

      {/* Párrafo 1 */}
      <Text style={[styles.bodyText, { textAlign: 'justify', fontSize: 10, lineHeight: 1.55 }]}>
        Atento a la solicitud de Pasividad Anticipada Voluntaria presentada por el Agente{' '}
        <Text style={styles.bold}>{data.nombreCompleto}</Text> DNI N°{' '}
        <Text style={styles.bold}>{data.dni}</Text> cargo{' '}
        <Text style={styles.bold}>{data.cargo || ''}</Text> dependiente de la{' '}
        <Text style={styles.bold}>{data.programa || ''}</Text>
      </Text>

      {/* Se informa */}
      <Text style={[styles.bodyText, { marginTop: 22, textAlign: 'left', fontSize: 10 }]}>
        Se informa
      </Text>

      {/* Párrafo 2 */}
      <Text style={[styles.bodyText, { marginTop: 18, textAlign: 'justify', fontSize: 10, lineHeight: 1.55 }]}>
        Que, a los fines de la prosecución del trámite, corresponde REMITIR las presentes actuaciones a la DIRECCION GENERAL DE COORDINACIÓN Y SUMARIOS, a efectos de que se informe si el agente detallado ut supra registra sumario administrativo pendiente.
      </Text>

      {/* Párrafo 3 */}
      <Text style={[styles.bodyText, { marginTop: 18, textAlign: 'justify', fontSize: 10, lineHeight: 1.55 }]}>
        Cumplido lo requerido precedentemente, deberán remitirse las actuaciones a{' '}
        <Text style={styles.bold}>{data.secretaria || 'SECRETARIA'}</Text> a los fines de que se complete debidamente el formulario obrante a fs. 02 por la autoridad a cargo, requisito indispensable para la continuidad del trámite.
      </Text>

      {/* Hecho, vuelva */}
      <Text style={[styles.bodyText, { marginTop: 20, fontSize: 10 }]}>
        Hecho, vuelva.
      </Text>

      {/* Atentamente */}
      <Text style={[styles.bodyText, { marginTop: 28, fontSize: 10 }]}>
        Atentamente
      </Text>

      {/* Pie de página institucional */}
      <Text style={styles.footer}>Chacabuco 737 – subsecretaria.capitalhumano@cordoba.gov.ar</Text>
    </Page>
  </Document>
);

// ── 3. FORMULARIO DE SOLICITUD PAV ───────────────────────────────────────────
export const PavSolicitud = ({ data }: { data: PAVData }) => {
  const fechaStr = data.fechaActual || new Date().toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Logos institucionales centrados y más grandes */}
        <View style={styles.headerLogoContainer}>
          <Image src={LOGO_PAV_HEADER} style={styles.headerLogo} />
        </View>

        {/* Lugar y fecha a la derecha sin corchetes */}
        <View style={[styles.rightExpBox, { marginBottom: 20 }]}>
          <Text style={{ fontSize: 9.5 }}>
            Córdoba, <Text style={styles.bold}>{fechaStr}</Text>.
          </Text>
        </View>

        {/* Título */}
        <Text style={styles.title}>Formulario de Pasividad Anticipada Voluntaria</Text>
        <Text style={[styles.subtitle, { marginBottom: 22 }]}>
          Ley Provincial Nº 8836 - Ordenanza Nº 10,514 - Decreto Nº 1282
        </Text>

        {/* Destinatario */}
        <View style={{ marginBottom: 18 }}>
          <Text style={[styles.bodyText, { fontSize: 10 }]}>Señor</Text>
          <Text style={[styles.bodyText, { fontSize: 10 }]}>Intendente Municipal</Text>
          <Text style={[styles.bodyText, { fontSize: 10 }]}>S_______/_______D</Text>
        </View>

        {/* Párrafos solicitud */}
        <Text style={[styles.bodyText, { textAlign: 'justify', fontSize: 10, lineHeight: 1.55, marginBottom: 14 }]}>
          Por el presente manifiesto mi decisión de acogerme al Régimen de Pasividad Anticipada Voluntaria, en los términos del Art.29 de la Ley Nº 8836 y su reglamentación, los que expresamente manifiesto conocer y aceptar.
        </Text>

        <Text style={[styles.bodyText, { textAlign: 'justify', fontSize: 10, lineHeight: 1.55, marginBottom: 22 }]}>
          De ser aceptada la presente solicitud por la autoridad competente, se me notificará para la firma del acuerdo respectivo, cuya suscripción quedará supeditada a mi conformidad con su contenido, para su posterior homologación por la autoridad laboral.
        </Text>

        <Text style={[styles.bodyText, { textAlign: 'center', fontSize: 10, marginBottom: 30 }]}>
          Atentamente.
        </Text>

        {/* Bloque de firmas del Agente */}
        <View style={{ marginBottom: 30 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 16 }}>
            <Text style={{ width: 130, fontSize: 9.5, fontFamily: 'Helvetica-Bold' }}>Firma del Agente</Text>
            <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: '#000' }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 16 }}>
            <Text style={{ width: 130, fontSize: 9.5, fontFamily: 'Helvetica-Bold' }}>Aclaración de Firma</Text>
            <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: '#000' }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <Text style={{ width: 130, fontSize: 9.5, fontFamily: 'Helvetica-Bold' }}>DNI Nº</Text>
            <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: '#000' }} />
          </View>
        </View>

        {/* Recuadro Recursos Humanos sin corchetes */}
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontSize: 9.5, fontFamily: 'Helvetica-Bold', textDecoration: 'underline' }}>
            Para uso exclusivo de Recursos Humanos:
          </Text>
          <Text style={{ fontSize: 8.5, marginTop: 4 }}>
            CERTIFICO QUE LA FIRMA QUE ANTECEDE PERTENECE A :
          </Text>

          <Text style={{ fontSize: 9.5, marginTop: 12 }}>
            <Text style={styles.bold}>{data.nombreCompleto}</Text> DNI Nº{' '}
            <Text style={styles.bold}>{data.dni}</Text> CONSTE.
          </Text>

          <Text style={{ fontSize: 9, marginTop: 12, fontFamily: 'Helvetica-Bold' }}>
            FECHA DE RECEPCION DE SOLICITUD: ------------------------------------------------------------------
          </Text>

          <Text style={{ fontSize: 9, marginTop: 12, fontFamily: 'Helvetica-Bold' }}>
            FIRMA Y ACLARACION: ------------------------------------------------------------------
          </Text>
        </View>

        {/* Pie de página institucional */}
        <Text style={styles.footer}>Chacabuco 737 – subsecretaria.capitalhumano@cordoba.gov.ar</Text>
      </Page>
    </Document>
  );
};

// ── 4. PASE AL ARCHIVO PAV ────────────────────────────────────────────────────
export const PavPaseArchivo = ({ data }: { data: PAVData }) => {
  const fechaStr = data.fechaActual || new Date().toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Logos institucionales centrados y más grandes */}
        <View style={styles.headerLogoContainer}>
          <Image src={LOGO_PAV_HEADER} style={styles.headerLogo} />
        </View>

        {/* Lugar y fecha a la derecha */}
        <View style={[styles.rightExpBox, { marginBottom: 28 }]}>
          <Text style={{ fontSize: 9.5, textAlign: 'right' }}>
            Córdoba, <Text style={styles.bold}>{fechaStr}</Text>.
          </Text>
          <Text style={[styles.expText, { marginTop: 6 }]}>
            Ref. Expediente Nº {data.nroExpPasividad || ''}.
          </Text>
        </View>

        {/* Asunto */}
        <Text style={[styles.bodyText, { fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'justify', marginBottom: 22 }]}>
          Asunto: &quot;Pasividad Anticipada Voluntaria&quot;
        </Text>

        {/* Párrafo principal */}
        <Text style={[styles.bodyText, { textAlign: 'justify', fontSize: 10, lineHeight: 1.55 }]}>
          Atento a lo manifestado por el agente{' '}
          <Text style={styles.bold}>{data.nombreCompleto}</Text> -{' '}
          <Text style={styles.bold}>{data.dni}</Text>, PASE las presentes actuaciones a la SUBDIRECCION DE ATENCION PRESENCIAL para su ARCHIVO.
        </Text>

        {/* Pie de página institucional */}
        <Text style={styles.footer}>Chacabuco 737 – subsecretaria.capitalhumano@cordoba.gov.ar</Text>
      </Page>
    </Document>
  );
};

// ── 5. DESISTIDO PAV ──────────────────────────────────────────────────────────
export const PavDesistido = ({ data }: { data: PAVData }) => {
  const fechaStr = data.fechaActual || new Date().toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Logos institucionales centrados y más grandes */}
        <View style={styles.headerLogoContainer}>
          <Image src={LOGO_PAV_HEADER} style={styles.headerLogo} />
        </View>

        {/* Lugar y fecha a la derecha */}
        <View style={[styles.rightExpBox, { marginBottom: 28 }]}>
          <Text style={{ fontSize: 9.5, textAlign: 'right' }}>
            Córdoba, <Text style={styles.bold}>{fechaStr}</Text>.
          </Text>
        </View>

        {/* Asunto */}
        <Text style={[styles.bodyText, { fontSize: 10, fontFamily: 'Helvetica-Bold', textAlign: 'justify', marginBottom: 22 }]}>
          Asunto: &quot;Pasividad Anticipada Voluntaria&quot;
        </Text>

        {/* Párrafo de desistimiento */}
        <Text style={[styles.bodyText, { textAlign: 'justify', fontSize: 10, lineHeight: 1.55, marginBottom: 18 }]}>
          Por medio del presente me dirijo a Ud. a los efectos de manifestar mi voluntad expresa de DESISTIR del trámite de Pasividad Anticipada Voluntaria (PAV), oportunamente iniciado mediante el Expediente N.º{' '}
          <Text style={styles.bold}>{data.nroExpPasividad || ''}</Text>, solicitando asimismo el archivo de las presentes actuaciones.
        </Text>

        {/* Despedida */}
        <Text style={[styles.bodyText, { textAlign: 'justify', fontSize: 10, lineHeight: 1.55, marginBottom: 30 }]}>
          Sin otro particular, saludo a Ud. atentamente.
        </Text>

        {/* Bloque de firmas del Agente */}
        <View style={{ marginBottom: 30 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 16 }}>
            <Text style={{ width: 130, fontSize: 9.5, fontFamily: 'Helvetica-Bold' }}>Firma</Text>
            <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: '#000' }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginBottom: 16 }}>
            <Text style={{ width: 130, fontSize: 9.5, fontFamily: 'Helvetica-Bold' }}>Aclaración</Text>
            <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: '#000' }} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
            <Text style={{ width: 130, fontSize: 9.5, fontFamily: 'Helvetica-Bold' }}>DNI Nº</Text>
            <View style={{ flex: 1, borderBottomWidth: 1, borderBottomColor: '#000' }} />
          </View>
        </View>

        {/* Atte. */}
        <Text style={[styles.bodyText, { fontSize: 10, marginBottom: 10 }]}>
          Atte.
        </Text>

        {/* Pie de página institucional */}
        <Text style={styles.footer}>Chacabuco 737 – subsecretaria.capitalhumano@cordoba.gov.ar</Text>
      </Page>
    </Document>
  );
};

// ── 6. RENUNCIA POR RAZONES PARTICULARES (Pase Repartición) ───────────────────
export const RenunciaRazonesParticulares = ({ data }: { data: PAVData }) => {
  const fechaStr = data.fechaActual || new Date().toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Logos institucionales centrados y más grandes */}
        <View style={styles.headerLogoContainer}>
          <Image src={LOGO_PAV_HEADER} style={styles.headerLogo} />
        </View>

        {/* Lugar y fecha a la derecha */}
        <View style={[styles.rightExpBox, { marginBottom: 24 }]}>
          <Text style={{ fontSize: 9.5, textAlign: 'right' }}>
            Córdoba, <Text style={styles.bold}>{fechaStr}</Text>.-
          </Text>
          <Text style={[styles.expText, { marginTop: 6 }]}>
            Expediente Nº: {data.nroExpMunRenuncia || ''}.-
          </Text>
        </View>

        {/* Párrafo de renuncia */}
        <Text style={[styles.bodyText, { textAlign: 'justify', fontSize: 10, lineHeight: 1.55, marginBottom: 18 }]}>
          Atento a la Renuncia por Razones Particulares presentada por el Agente{' '}
          <Text style={styles.bold}>{data.nombreCompleto}</Text>, CUIL Nº:{' '}
          <Text style={styles.bold}>{data.cuil || ''}</Text>, CARGO:{' '}
          <Text style={styles.bold}>{data.cargo || ''}</Text>, dependiente de la{' '}
          <Text style={styles.bold}>{data.programa || ''}</Text> a partir de{' '}
          <Text style={styles.bold}>{data.fBaja || ''}</Text>
        </Text>

        {/* Se informa */}
        <Text style={[styles.bodyText, { marginTop: 8, fontSize: 10 }]}>
          Se informa:
        </Text>

        {/* Punto 1 */}
        <Text style={[styles.bodyText, { marginTop: 10, textAlign: 'justify', fontSize: 10, lineHeight: 1.55 }]}>
          1)  Que la renuncia se encuadra en las disposiciones del Art. 40º y 41º de la Ordenanza 7244/80 (Decreto Reglamentario Nº 15975-A-82).
        </Text>

        {/* Punto 2 */}
        <Text style={[styles.bodyText, { marginTop: 12, textAlign: 'justify', fontSize: 10, lineHeight: 1.55 }]}>
          2)  Se sugiere, al momento del dictado de la Resolución correspondiente, que disponga la Baja del agente, se exprese que: &quot;Por la Subsecretaría de Capital Humano se procederá al pago de la liquidación final del agente en cuestión&quot;.
        </Text>

        {/* Párrafo final */}
        <Text style={[styles.bodyText, { marginTop: 14, textAlign: 'justify', fontSize: 10, lineHeight: 1.55 }]}>
          Que la renuncia corresponde aceptarla a partir de la fecha mencionada ut supra y en el estado de las presentes actuaciones PASEN las mismas al Dirección General de ART y Control Legal para Control Técnico de legalidad.
        </Text>

        {/* Atentamente */}
        <Text style={[styles.bodyText, { marginTop: 26, fontSize: 10 }]}>
          Atentamente.
        </Text>

        {/* Pie de página institucional */}
        <Text style={styles.footer}>Chacabuco 737 – subsecretaria.capitalhumano@cordoba.gov.ar</Text>
      </Page>
    </Document>
  );
};

// ── 7. INVALIDEZ PROVISORIA (Pase Interno) ────────────────────────────────────
export const InvalidesProvisoria = ({ data }: { data: PAVData }) => {
  const fechaStr = data.fechaActual || new Date().toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Logos institucionales centrados y más grandes */}
        <View style={styles.headerLogoContainer}>
          <Image src={LOGO_PAV_HEADER} style={styles.headerLogo} />
        </View>

        {/* Lugar y fecha a la derecha */}
        <View style={[styles.rightExpBox, { marginBottom: 24 }]}>
          <Text style={{ fontSize: 9.5, textAlign: 'right' }}>
            Córdoba, <Text style={styles.bold}>{fechaStr}</Text>.-
          </Text>
          <Text style={[styles.expText, { marginTop: 6 }]}>
            Expediente Nº: {data.nroExpMunRenuncia || ''}.-
          </Text>
        </View>

        {/* Párrafo de renuncia */}
        <Text style={[styles.bodyText, { textAlign: 'justify', fontSize: 10, lineHeight: 1.55, marginBottom: 14 }]}>
          Atento a la renuncia presentada por el Agente{' '}
          <Text style={styles.bold}>{data.nombreCompleto}</Text>, CUIL Nº:{' '}
          <Text style={styles.bold}>{data.cuil || ''}</Text>, CARGO:{' '}
          <Text style={styles.bold}>{data.cargo || ''}</Text> dependiente de la{' '}
          <Text style={styles.bold}>{data.programa || ''}</Text> considerando:
        </Text>

        {/* Párrafo resolución caja */}
        <Text style={[styles.bodyText, { textAlign: 'justify', fontSize: 10, lineHeight: 1.55, marginBottom: 14 }]}>
          Que mediante Resolución Serie &quot;A&quot; Nº:{' '}
          <Text style={styles.bold}>{data.nroResRenCaja || ''}</Text>, de fecha 27 de julio de 2026 dictada por la Caja de Jubilaciones, Pensiones y Retiros de Córdoba mediante Expediente Nº J-{' '}
          <Text style={styles.bold}>{data.jNroExpCaja || ''}</Text>, deberá aceptarse la RENUNCIA a los fines de acogerse al Beneficio de la JUBILACIÓN POR INVALIDEZ EN FORMA PROVISORIA a partir del{' '}
          <Text style={styles.bold}>{data.fechaDesdeProv || ''}</Text> y cuyo vencimiento operará con fecha{' '}
          <Text style={styles.bold}>{data.fechaHastaProv || ''}</Text>.
        </Text>

        {/* Se informa */}
        <Text style={[styles.bodyText, { marginTop: 8, fontSize: 10 }]}>
          Se informa:
        </Text>

        {/* Punto 1 */}
        <Text style={[styles.bodyText, { marginTop: 10, textAlign: 'justify', fontSize: 10, lineHeight: 1.55 }]}>
          Que la renuncia se encuadra en las disposiciones del Art. 40º y 41º de la Ordenanza 7244/80 (Decreto Reglamentario Nº 15975-A-82).
        </Text>

        {/* Párrafo final */}
        <Text style={[styles.bodyText, { marginTop: 14, textAlign: 'justify', fontSize: 10, lineHeight: 1.55 }]}>
          Que la renuncia corresponde aceptarla a partir de la fecha mencionada ut supra y en el estado de las presentes actuaciones PASEN al Dirección General de ART y Control Legal para Control Técnico de legalidad.
        </Text>

        {/* Atentamente */}
        <Text style={[styles.bodyText, { marginTop: 26, fontSize: 10 }]}>
          Atentamente.
        </Text>

        {/* Pie de página institucional */}
        <Text style={styles.footer}>Chacabuco 737 – subsecretaria.capitalhumano@cordoba.gov.ar</Text>
      </Page>
    </Document>
  );
};
