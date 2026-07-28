from datetime import datetime
from django.utils import timezone

class ForecastClockService:
    """ 
        Servicio especializado en determinar la ventana temporal de ejecución NOAA GFS. 
    """
    
    @staticmethod
    def get_current_run_code(now_dt: datetime = None) -> tuple[str, datetime]:
        """ 
            Retorna el código de ejecución unívoco (ej. AUTO_20260728_12Z) y la fecha base.
        """
        now_utc = now_dt or timezone.now()
        hour = now_utc.hour
        
        if hour < 6:
            run_hour = 0
        elif hour < 12:
            run_hour = 6
        elif hour < 18:
            run_hour = 12
        else:
            run_hour = 18

        run_time_str = f"{run_hour:02d}Z"
        date_str = now_utc.strftime('%Y%m%d')
        request_code = f"AUTO_{date_str}_{run_time_str}"
        
        return request_code, now_utc