from django.core.validators import RegexValidator

# ==============================================================================
# VALIDADORES DE ATRIBUTOS DEL MÓDULO
# ==============================================================================

department_ubigeo_validator = RegexValidator(
    regex=r'^\d{2}$',
    message='El código UBIGEO de departamento debe contener exactamente 2 dígitos numéricos (ej: "01", "12").'
)

province_ubigeo_validator = RegexValidator(
    regex=r'^\d{4}$',
    message='El código UBIGEO de provincia debe contener exactamente 4 dígitos numéricos (ej: "0101", "1203").'
)

district_ubigeo_validator = RegexValidator(
    regex=r'^\d{6}$',
    message='El código UBIGEO de distrito debe contener exactamente 6 dígitos numéricos (ej: "010101", "120303").'
)

sector_code_validator = RegexValidator(
    regex=r'^\d{3}$',
    message='El código del sector debe contener exactamente 3 dígitos numéricos (ej: "001", "012").'
)