# Representa la tolerencia que tiene el programa para determinar si una alerta debe ser considerada como cerrada:
    # - Cerrada: Se determina así a una alerta cuando la hora de finalización de la precipitación no puede ser cambiada
INERTIA_HOURS = 2 

# Mínimo de horas previas requeridas para que una alerta sea listada cuando se utiliza el filtro correspondiente
MINIMUM_HOURS_TO_START_FILTER = 6

# Número máximo de unidades operativas visibles en el mensaje de alerta
MAXIMUM_VISIBLE_OPERATIVE_UNITS = 3

# Número máximo de días que una alerta ATENDIDA seguirá siendo mostrada
MAXIMUM_DAYS_TO_SHOW_ATTENDED_ALERTS = 3

# Tiempo de espera en segundos para el envío del mensaje de alerta a Telegram (entre mensajes)
TELEGRAM_DISPATCH_DELAY = 3