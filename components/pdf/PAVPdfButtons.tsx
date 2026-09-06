'use client'

import React, { useState } from 'react';
import { PavAceptacionRechazo, PavPaseSecretaria, PavSolicitud, type PAVData } from './PAVForms';
import { type DocumentProps } from '@react-pdf/renderer';
import { Download, Loader2 } from 'lucide-react';

interface PAVPdfButtonsProps {
  data: PAVData;
}

export function PAVPdfButtons({ data }: PAVPdfButtonsProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleGenerate = async (type: 'aceptacion' | 'pase' | 'solicitud') => {
    // Validación de campos
    if (!data.nombreCompleto || !data.nroExpPasividad || !data.fSolicitud) {
      alert("Faltan datos requeridos para generar el formulario.\nPor favor complete:\n- Nombre Completo\n- Número Expediente Pasividad\n- Fecha Solicitud de Pasividad");
      return;
    }

    setLoading(type);
    try {
      // Importamos dinámicamente para evitar problemas con SSR en Next.js
      const { pdf } = await import('@react-pdf/renderer');
      
      let doc: React.ReactElement<DocumentProps>;
      let filename = '';

      if (type === 'aceptacion') {
        doc = <PavAceptacionRechazo data={data} />;
        filename = `PAV_Aceptacion_${data.dni}.pdf`;
      } else if (type === 'pase') {
        doc = <PavPaseSecretaria data={data} />;
        filename = `PAV_PaseSecretaria_${data.dni}.pdf`;
      } else {
        doc = <PavSolicitud data={data} />;
        filename = `PAV_Solicitud_${data.dni}.pdf`;
      }

      const blob = await pdf(doc).toBlob();

      // Crear link para descargar
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert("Formulario generado y descargado con éxito.");

    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Hubo un error al generar el PDF.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200 mt-2">
      <button
        type="button"
        onClick={() => handleGenerate('solicitud')}
        disabled={loading !== null}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50"
      >
        {loading === 'solicitud' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        Generar Solicitud PAV
      </button>

      <button
        type="button"
        onClick={() => handleGenerate('pase')}
        disabled={loading !== null}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50"
      >
        {loading === 'pase' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        Generar Pase Secretaria PAV
      </button>

      <button
        type="button"
        onClick={() => handleGenerate('aceptacion')}
        disabled={loading !== null}
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition disabled:opacity-50"
      >
        {loading === 'aceptacion' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
        Generar Aceptación/Rechazo PAV
      </button>
    </div>
  );
}
