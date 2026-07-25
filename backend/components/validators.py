from django.core.validators import RegexValidator

# ==============================================================================
# VALIDADORES DE ATRIBUTOS DEL MÓDULO
# ==============================================================================

operational_status_code_validator = RegexValidator(
    regex=r'^\d{3}$',
    message='El código de estado operativo debe contener exactamente 3 dígitos numéricos (ej: "001", "002").'
)

physical_status_code_validator = RegexValidator(
    regex=r'^[A-Z]{1}$',
    message='El código de estado físico debe contener exactamente 1 carácter alfabético mayúsculo (ej: "A", "I").'
)

component_code_validator = RegexValidator(
    regex=r'^\d{4}$',
    message='El código del componente debe contener exactamente 4 dígitos numéricos (ej: "0001", "0012").'
)