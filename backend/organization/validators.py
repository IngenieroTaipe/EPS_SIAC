from django.core.validators import RegexValidator

# ==============================================================================
# VALIDADORES DE ATRIBUTOS DEL MÓDULO
# ==============================================================================

branch_code_validator = RegexValidator(
    regex=r'^\d{3}$',
    message='El código de sucursal debe contener exactamente 3 dígitos numéricos (ej: "001", "002").'
)

dni_validator = RegexValidator(
    regex=r'^\d{8}$',
    message='El DNI debe contener exactamente 8 dígitos numéricos (ej: "12345678", "87654321").'
)

phone_number_validator = RegexValidator(
    regex=r'^[9]\d{8}$',
    message='El número de teléfono/celular debe empezar con 9 y contener 8 dígitos más (ej: "912345678", "998765432").'
)