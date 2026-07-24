# core_shared/formatters.py
"""
Módulo Central de Formateo y Limpieza de Atributos.
"""
import re

class DataFormatter:
    """
    Suite de métodos estáticos para normalización de atributos.
    """

    @staticmethod
    def trim_string(value: str) -> str:
        """
            Elimina espacios al inicio, al final y reduce múltiples espacios internos a uno solo.
            Ejemplo: "  SAN   RAMON  " -> "SAN RAMON"
        """
        if not isinstance(value, str):
            return value
        return re.sub(r'\s+', ' ', value.strip())

    @staticmethod
    def upper_case(value: str) -> str:
        """
        Limpia espacios internos/externos y convierte a MAYÚSCULAS.
        Ejemplo: "  pichanaqui  " -> "PICHANAQUI"
        """
        if not isinstance(value, str):
            return value
        return DataFormatter.trim_string(value).upper()

    @staticmethod
    def title_case(value: str) -> str:
        """
            Limpia espacios internos/externos y convierte a Formato Título (capitalize).
            Ejemplo: "  pichanaqui  " -> "Pichanaqui"
        """
        if not isinstance(value, str):
            return value
        return DataFormatter.trim_string(value).title()

    @staticmethod
    def zfill(digits: int):
        """
            Orden Superior (Closure): Retorna una función personalizada para rellenar N ceros.
            Ejemplo: zfill(6)("120303") -> "120303", zfill(6)("61005") -> "061005"
        """
        def formatter(value: str) -> str:
            if value is None:
                return value
            clean_val = str(value).strip()
            return clean_val.zfill(digits) if clean_val.isdigit() else clean_val
        return formatter