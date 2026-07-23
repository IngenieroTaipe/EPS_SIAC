from django.db import models
from django.utils import timezone

# Create your models here.
class SoftDeleteManager(models.Manager):
    '''
        Manager para la eliminación suave (soft deletes) de los registros en los modelos
    '''

    def get_queryset(self):
        return super().get_queryset().filter(deleted_at__isnull=True)
    
class AuditCreateModel(models.Model):
    '''
        AudithCreateModel con campos en común para todos los demás modelos. 
        Incluye campos de fecha de creación, actualización y eliminación suave (soft delete).
    '''
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        abstract=True

class AuditCompleteModel(AuditCreateModel):
    '''
        AuditCompleteModel con campos en común para todos los demás modelos. 
        Incluye campos de fecha de creación, actualización y eliminación suave (soft delete).
    '''
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(blank=True, null=True)

    objects = SoftDeleteManager()
    all_objects = models.Manager()

    class Meta:
        abstract=True

    def delete(self, using=None, keep_parents=False):
        '''
            Método para realizar una eliminación suave (soft delete) del registro.
            Se establece la fecha de eliminación en el campo `deleted_at` y se guarda el registro.
            Se utiliza `using` para especificar la base de datos a utilizar, y `keep_parents` para mantener los padres del modelo.
        '''
        self.deleted_at = timezone.now()
        self.save(using=using)

    def hard_delete(self, using=None, keep_parents=False):
        '''
            Método para realizar una eliminación permanente (hard delete) del registro.
            Se llama al método `delete` del modelo padre para eliminar el registro de la base de datos.
            Se utiliza `using` para especificar la base de datos a utilizar, y `keep_parents` para mantener los padres del modelo.
        '''
        super().delete(using=using, keep_parents=keep_parents)

    def restore(self):
        self.deleted_at = None
        self.save()