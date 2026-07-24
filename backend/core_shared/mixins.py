from typing import Dict, Callable, Union
from core_shared.formatters import DataFormatter

class PrepareDataMixin:
    """
        La clase permite la sanitización y arreglo inicial de la información antes de pasar a la validación en los serializers. La clase sobreescribe el método to_internal_value, por lo que la sanitización ocurrirá antes de que los serializers verifiquen la información.

        Para que la clase tenga efecto es imperante que se defina el diccionario prepare_fields en cada serializer, indicando tanto el nombre del capo a sanitizar, así como el método que se utilizará (de manera string o función).

        prepare_fields = {
            'field_name': DataFormatter.title_case,
            'ubigeo': DataFormatter.zfill(6),
        }
    """
    prepare_fields: Dict[str, Union[Callable, str]] = {}

    def to_internal_value(self, data):
        # Clonamos la información
        data = data.copy() if hasattr(data, 'copy') else dict(data)

        for field, formatter in self.prepare_fields.items():
            if field in data and data[field] is not None:

                # En caso de ser una función
                if callable(formatter):
                    data[field] = formatter(data[field])

                # En caso de ser un string
                elif isinstance(formatter, str) and hasattr(DataFormatter, formatter):
                    method = getattr(DataFormatter, formatter)
                    data[field] = method(data[field])

        return super().to_internal_value(data)